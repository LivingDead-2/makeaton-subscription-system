import uuid
from datetime import date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import (
    Invoice,
    InvoiceLine,
    InvoiceStatus,
    Subscription,
    SubStatus,
    User,
    UserRole
)
from app.routers.auth import get_current_user, require_staff_or_admin

router = APIRouter()

# --- Pydantic Schemas ---
class InvoiceLineResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    description: Optional[str] = None
    quantity: int
    unit_price: float
    tax_amount: float
    line_total: float

    class Config:
        from_attributes = True

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    subscription_id: Optional[int] = None
    customer_id: int
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    subtotal: Optional[float] = 0.0
    tax_total: Optional[float] = 0.0
    discount_total: Optional[float] = 0.0
    grand_total: Optional[float] = 0.0
    paid_amount: Optional[float] = 0.0
    status: InvoiceStatus
    lines: List[InvoiceLineResponse] = []

    class Config:
        from_attributes = True

class GenerateInvoiceRequest(BaseModel):
    subscription_id: int

# --- API Endpoints ---

@router.post("/generate", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def generate_invoice_from_subscription(
    payload: GenerateInvoiceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    sub = db.query(Subscription).filter(Subscription.id == payload.subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if sub.status not in [SubStatus.ACTIVE, SubStatus.CONFIRMED]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot generate invoice for subscription in '{sub.status.value}' state. Must be ACTIVE or CONFIRMED."
        )

    calculated_subtotal = 0.0
    calculated_tax_total = 0.0
    calculated_grand_total = 0.0
    line_snapshots = []

    for line in sub.lines:
        line_base = line.quantity * line.unit_price
        line_tax = line_base * ((line.tax_percent or 0.0) / 100.0)
        line_total = line_base + line_tax

        calculated_subtotal += line_base
        calculated_tax_total += line_tax
        calculated_grand_total += line_total

        line_snapshots.append({
            "product_id": line.product_id,
            "description": f"Subscription charge (Product #{line.product_id})",
            "quantity": line.quantity,
            "unit_price": line.unit_price,
            "tax_amount": round(line_tax, 2),
            "line_total": round(line_total, 2)
        })

    today = date.today()
    due = today + timedelta(days=sub.payment_terms_days or 15)
    inv_number = f"INV-{uuid.uuid4().hex[:8].upper()}"

    new_invoice = Invoice(
        invoice_number=inv_number,
        subscription_id=sub.id,
        customer_id=sub.customer_id,
        issue_date=today,
        due_date=due,
        subtotal=round(calculated_subtotal, 2),
        tax_total=round(calculated_tax_total, 2),
        discount_total=0.0,
        grand_total=round(calculated_grand_total, 2),
        paid_amount=0.0,
        status=InvoiceStatus.DRAFT
    )
    db.add(new_invoice)
    db.flush()

    for item in line_snapshots:
        inv_line = InvoiceLine(
            invoice_id=new_invoice.id,
            product_id=item["product_id"],
            description=item["description"],
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            tax_amount=item["tax_amount"],
            line_total=item["line_total"]
        )
        db.add(inv_line)

    db.commit()
    db.refresh(new_invoice)
    return new_invoice

@router.get("/", response_model=List[InvoiceResponse])
def list_invoices(
    customer_id: Optional[int] = None,
    status_filter: Optional[InvoiceStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Invoice)

    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_val == "CUSTOMER":
        query = query.filter(Invoice.customer_id == current_user.id)
    elif customer_id:
        query = query.filter(Invoice.customer_id == customer_id)

    if status_filter:
        query = query.filter(Invoice.status == status_filter)

    return query.order_by(Invoice.id.desc()).all()

@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_val == "CUSTOMER" and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this invoice")

    return invoice

@router.patch("/{invoice_id}/confirm", response_model=InvoiceResponse)
def confirm_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    """
    Confirm and issue a draft invoice for payment.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    status_val = invoice.status.value if hasattr(invoice.status, "value") else str(invoice.status)
    if status_val != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot confirm invoice in '{status_val}' state. Must be DRAFT."
        )

    invoice.status = InvoiceStatus.CONFIRMED
    db.commit()
    db.refresh(invoice)
    return invoice

@router.patch("/{invoice_id}/cancel", response_model=InvoiceResponse)
def cancel_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    status_val = invoice.status.value if hasattr(invoice.status, "value") else str(invoice.status)
    if status_val == "PAID":
        raise HTTPException(status_code=400, detail="Cannot cancel an invoice that has already been paid.")

    invoice.status = InvoiceStatus.CANCELLED
    db.commit()
    db.refresh(invoice)
    return invoice
