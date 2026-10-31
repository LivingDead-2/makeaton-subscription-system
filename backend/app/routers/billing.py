from datetime import date, timedelta
from calendar import monthrange
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    Subscription,
    SubscriptionLine,
    Invoice,
    InvoiceLine,
    Discount,
    DiscountType,
    SubStatus,
    InvoiceStatus,
)
from app.schemas import InvoiceResponse
from app.routers.auth import require_admin, require_staff_or_admin

router = APIRouter()


def add_billing_cycle(current_date, cycle):
    """Calculate the next billing date."""
    if cycle.value == "DAILY":
        return current_date + timedelta(days=1)

    if cycle.value == "WEEKLY":
        return current_date + timedelta(weeks=1)

    if cycle.value == "MONTHLY":
        next_month = current_date.month + 1
        next_year = current_date.year

        if next_month > 12:
            next_month = 1
            next_year += 1

        day = min(
            current_date.day,
            monthrange(next_year, next_month)[1]
        )

        return date(next_year, next_month, day)

    if cycle.value == "YEARLY":
        try:
            return current_date.replace(year=current_date.year + 1)
        except ValueError:
            return current_date.replace(
                year=current_date.year + 1,
                day=28
            )

    raise ValueError("Unsupported billing cycle")



def calculate_discount(db, subscription, subtotal, quantity):
    """Calculate discount only on eligible subscription products."""

    if not subscription.applied_discount_id:
        return 0.0, None

    discount = db.query(Discount).filter(
        Discount.id == subscription.applied_discount_id
    ).first()

    if not discount:
        return 0.0, None

    today = date.today()

    # Check discount validity dates.
    if discount.valid_from and today < discount.valid_from:
        return 0.0, None

    if discount.valid_to and today > discount.valid_to:
        return 0.0, None

    # Check usage limit.
    if (
        discount.usage_limit is not None
        and discount.times_used >= discount.usage_limit
    ):
        return 0.0, None

    # Identify eligible subscription lines.
    eligible_lines = [
        line for line in subscription.lines
        if discount.product_id is None
        or line.product_id == discount.product_id
    ]

    if not eligible_lines:
        return 0.0, None

    eligible_amount = sum(
        line.unit_price * line.quantity
        for line in eligible_lines
    )

    eligible_quantity = sum(
        line.quantity for line in eligible_lines
    )

    # Check minimum purchase requirements.
    if eligible_amount < discount.min_amount:
        return 0.0, None

    if eligible_quantity < discount.min_quantity:
        return 0.0, None

    # Calculate discount.
    if discount.discount_type == DiscountType.PERCENTAGE:
        amount = eligible_amount * discount.value / 100
    else:
        amount = discount.value

    return round(min(amount, eligible_amount), 2), discount



# --------------------------------------------------
# 1. AUTOMATIC INVOICE GENERATION
# --------------------------------------------------

@router.post("/generate", response_model=list[InvoiceResponse])
def generate_invoices(
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    today = date.today()

    subscriptions = db.query(Subscription).options(
        joinedload(Subscription.lines),
        joinedload(Subscription.plan)
    ).filter(
        Subscription.status == SubStatus.ACTIVE,
        Subscription.next_billing_date <= today
    ).all()

    generated_invoices = []

    try:
        for subscription in subscriptions:

            # Skip subscriptions with no billing lines.
            if not subscription.lines:
                continue

            # Prevent duplicate invoice generation.
            existing_invoice = db.query(Invoice).filter(
                Invoice.subscription_id == subscription.id,
                Invoice.issue_date == today
            ).first()

            if existing_invoice:
                continue

            subtotal = 0.0
            tax_total = 0.0
            total_quantity = 0
            invoice_lines = []

            for line in subscription.lines:
                line_subtotal = round(
                    line.unit_price * line.quantity, 2
                )

                line_tax = round(
                    line_subtotal * line.tax_percent / 100, 2
                )

                subtotal += line_subtotal
                tax_total += line_tax
                total_quantity += line.quantity

                invoice_lines.append(
                    InvoiceLine(
                        product_id=line.product_id,
                        description=(
                            line.product.name
                            if line.product else "Subscription Product"
                        ),
                        quantity=line.quantity,
                        unit_price=line.unit_price,
                        tax_amount=line_tax,
                        line_total=round(
                            line_subtotal + line_tax, 2
                        )
                    )
                )

            subtotal = round(subtotal, 2)
            tax_total = round(tax_total, 2)

            discount_amount, discount = calculate_discount(
                db,
                subscription,
                subtotal,
                total_quantity
            )

            grand_total = round(
                subtotal + tax_total - discount_amount, 2
            )

            invoice = Invoice(
                invoice_number=f"INV-{uuid4().hex[:10].upper()}",
                subscription_id=subscription.id,
                customer_id=subscription.customer_id,
                status=InvoiceStatus.DRAFT,
                issue_date=today,
                due_date=today + timedelta(
                    days=subscription.payment_terms_days
                ),
                subtotal=subtotal,
                tax_total=tax_total,
                discount_total=round(discount_amount, 2),
                grand_total=grand_total,
                paid_amount=0.0,
                lines=invoice_lines
            )

            db.add(invoice)

            # Increment discount usage only when applied.
            if discount and discount_amount > 0:
                discount.times_used += 1

            # Update subscription billing dates.
            # Update subscription billing dates.
            previous_due_date = subscription.next_billing_date

            subscription.last_billed_date = today
            subscription.next_billing_date = add_billing_cycle(
                previous_due_date,
                subscription.plan.billing_cycle
            )

            # Automatically close expired subscriptions if configured.
            if (
                subscription.expiry_date
                and today >= subscription.expiry_date
                and subscription.plan.auto_close_on_expiry
            ):
                subscription.status = SubStatus.CLOSED

            generated_invoices.append(invoice)

        db.commit()

        for invoice in generated_invoices:
            db.refresh(invoice)

        return generated_invoices

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invoice generation failed."
        )


# --------------------------------------------------
# 2. LIST ALL INVOICES
# --------------------------------------------------

@router.get("/invoices", response_model=list[InvoiceResponse])
def list_invoices(
    db: Session = Depends(get_db),
    user=Depends(require_staff_or_admin)
):
    return db.query(Invoice).options(
        joinedload(Invoice.lines)
    ).order_by(
        Invoice.issue_date.desc()
    ).all()


# --------------------------------------------------
# 3. GET INVOICE DETAILS
# --------------------------------------------------

@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_staff_or_admin)
):
    invoice = db.query(Invoice).options(
        joinedload(Invoice.lines)
    ).filter(
        Invoice.id == invoice_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found."
        )

    return invoice


# --------------------------------------------------
# 4. CONFIRM INVOICE
# --------------------------------------------------

@router.post("/invoices/{invoice_id}/confirm")
def confirm_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_staff_or_admin)
):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found."
        )

    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail="Only draft invoices can be confirmed."
        )

    invoice.status = InvoiceStatus.CONFIRMED
    db.commit()

    return {
        "message": "Invoice confirmed successfully.",
        "invoice_id": invoice.id
    }


# --------------------------------------------------
# 5. CANCEL INVOICE
# --------------------------------------------------

@router.post("/invoices/{invoice_id}/cancel")
def cancel_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_admin)
):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found."
        )

    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail="Only draft invoices can be cancelled."
        )

    invoice.status = InvoiceStatus.CANCELLED
    db.commit()

    return {
        "message": "Invoice cancelled successfully.",
        "invoice_id": invoice.id
    }