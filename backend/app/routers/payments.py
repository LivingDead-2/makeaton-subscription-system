from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import (
    Invoice,
    InvoiceStatus,
    Payment,
    User,
    UserRole
)
from app.routers.auth import get_current_user, require_staff_or_admin

router = APIRouter()

# --- Pydantic Schemas ---
class PaymentCreate(BaseModel):
    invoice_id: int
    amount: float
    payment_method: str = "Credit Card"
    reference_note: Optional[str] = None

class PaymentResponse(BaseModel):
    id: int
    invoice_id: int
    payment_method: str
    amount: float
    payment_date: datetime
    reference_note: Optional[str] = None

    class Config:
        from_attributes = True

# --- API Endpoints ---

@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def record_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Record a payment against a CONFIRMED invoice.
    Updates the invoice's paid_amount and sets status to PAID once settled.
    """
    invoice = db.query(Invoice).filter(Invoice.id == payload.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    status_val = invoice.status.value if hasattr(invoice.status, "value") else str(invoice.status)
    if status_val not in ["CONFIRMED", "DRAFT"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot record payment for an invoice in '{status_val}' state."
        )

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    # Calculate remaining balance
    current_paid = invoice.paid_amount or 0.0
    remaining = round(invoice.grand_total - current_paid, 2)
    if payload.amount > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Payment exceeds balance due. Remaining balance: {remaining}"
        )

    # Persist payment record
    payment = Payment(
        invoice_id=invoice.id,
        payment_method=payload.payment_method,
        amount=payload.amount,
        payment_date=datetime.utcnow(),
        reference_note=payload.reference_note
    )
    db.add(payment)

    # Update invoice paid balance & status
    invoice.paid_amount = round(current_paid + payload.amount, 2)
    if invoice.paid_amount >= invoice.grand_total:
        invoice.status = InvoiceStatus.PAID

    db.commit()
    db.refresh(payment)
    return payment

@router.get("/invoice/{invoice_id}", response_model=List[PaymentResponse])
def get_payments_for_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_val == "CUSTOMER" and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access these payment records")

    return db.query(Payment).filter(Payment.invoice_id == invoice_id).all()
