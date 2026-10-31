from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Payment, Invoice, InvoiceStatus
from app.schemas import PaymentCreate, PaymentResponse
from app.routers.auth import require_staff_or_admin

router = APIRouter()


# --------------------------------------------------
# 1. RECORD A PAYMENT
# --------------------------------------------------

@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED
)
def record_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_staff_or_admin)
):
    invoice = db.query(Invoice).filter(
        Invoice.id == payload.invoice_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found."
        )

    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot record payment for a cancelled invoice."
        )

    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invoice is already fully paid."
        )

    if invoice.status != InvoiceStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only confirmed invoices can receive payments."
        )

    if payload.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be greater than zero."
        )

    remaining_amount = round(
        invoice.grand_total - invoice.paid_amount, 2
    )

    if payload.amount > remaining_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment exceeds the outstanding balance of {remaining_amount}."
        )

    payment = Payment(
        invoice_id=invoice.id,
        payment_method=payload.payment_method.strip(),
        amount=round(payload.amount, 2),
        reference_note=payload.reference_note
    )

    try:
        db.add(payment)

        invoice.paid_amount = round(
            invoice.paid_amount + payload.amount, 2
        )

        # Mark invoice as PAID only after full payment.
        if invoice.paid_amount >= invoice.grand_total:
            invoice.status = InvoiceStatus.PAID

        db.commit()
        db.refresh(payment)

        return payment

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to record payment."
        )


# --------------------------------------------------
# 2. GET ALL PAYMENTS
# --------------------------------------------------

@router.get("/", response_model=list[PaymentResponse])
def list_payments(
    db: Session = Depends(get_db),
    user=Depends(require_staff_or_admin)
):
    return db.query(Payment).order_by(
        Payment.payment_date.desc()
    ).all()


# --------------------------------------------------
# 3. GET PAYMENTS FOR A PARTICULAR INVOICE
# --------------------------------------------------

@router.get(
    "/invoice/{invoice_id}",
    response_model=list[PaymentResponse]
)
def get_invoice_payments(
    invoice_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_staff_or_admin)
):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found."
        )

    return db.query(Payment).filter(
        Payment.invoice_id == invoice_id
    ).order_by(
        Payment.payment_date.desc()
    ).all()