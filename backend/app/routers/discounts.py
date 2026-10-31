from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Discount, DiscountType, Invoice
from app.schemas import DiscountCreate, DiscountResponse
from app.routers.auth import require_admin, require_staff_or_admin

router = APIRouter()


# Request schema for checking a discount against an invoice
class DiscountValidationRequest(BaseModel):
    code: str
    invoice_id: int


# Response schema for discount validation
class DiscountValidationResponse(BaseModel):
    valid: bool
    message: str
    discount_code: str
    discount_amount: float = 0.0
    eligible_amount: float = 0.0

# --- Create Discount ---
@router.post(
    "/",
    response_model=DiscountResponse,
    status_code=status.HTTP_201_CREATED
)
def create_discount(
    payload: DiscountCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
   # Normalize discount code and check for duplicates
    normalized_code = payload.code.strip().upper()

    existing_discount = db.query(Discount).filter(
        Discount.code == normalized_code
    ).first()

    if existing_discount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discount code already exists."
        )

    # Validate percentage discount
    if (
        payload.discount_type == DiscountType.PERCENTAGE
        and payload.value > 100
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Percentage discount cannot exceed 100%."
        )

    # Validate date range
    if (
        payload.valid_from
        and payload.valid_to
        and payload.valid_from > payload.valid_to
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date cannot be later than end date."
        )

    # Verify product if product-specific discount is requested
    if payload.product_id is not None:
        from app.models import Product

        product = db.query(Product).filter(
            Product.id == payload.product_id
        ).first()

        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found."
            )

    discount = Discount(
        code=normalized_code,
        discount_type=payload.discount_type,
        value=payload.value,
        min_amount=payload.min_amount,
        min_quantity=payload.min_quantity,
        usage_limit=payload.usage_limit,
        times_used=0,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        product_id=payload.product_id
    )

    db.add(discount)

    try:
        db.commit()
        db.refresh(discount)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create discount."
        )

    return discount

# --- Validate Discount ---
@router.post(
    "/validate",
    response_model=DiscountValidationResponse
)
def validate_discount(
    payload: DiscountValidationRequest,
    db: Session = Depends(get_db),
    user=Depends(require_staff_or_admin)
):
    # Find the discount code
    normalized_code = payload.code.strip().upper()

    discount = db.query(Discount).filter(
        Discount.code == normalized_code
    ).first()

    if not discount:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discount code not found."
        )

    # Find the invoice
    invoice = db.query(Invoice).filter(
        Invoice.id == payload.invoice_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found."
        )

    # Check discount validity dates
    today = date.today()

    if discount.valid_from and today < discount.valid_from:
        return DiscountValidationResponse(
            valid=False,
            message="Discount is not active yet.",
            discount_code=discount.code
        )

    if discount.valid_to and today > discount.valid_to:
        return DiscountValidationResponse(
            valid=False,
            message="Discount has expired.",
            discount_code=discount.code
        )

    # Check usage limit
    if (
        discount.usage_limit is not None
        and discount.times_used >= discount.usage_limit
    ):
        return DiscountValidationResponse(
            valid=False,
            message="Discount usage limit has been reached.",
            discount_code=discount.code
        )

    # Calculate eligible amount and quantity
    eligible_amount = 0.0
    eligible_quantity = 0

    for line in invoice.lines:
        if (
            discount.product_id is None
            or line.product_id == discount.product_id
        ):
            eligible_amount += line.unit_price * line.quantity
            eligible_quantity += line.quantity

    # Check eligible products
    if eligible_quantity == 0:
        return DiscountValidationResponse(
            valid=False,
            message="No eligible products found in this invoice.",
            discount_code=discount.code
        )

    # Check minimum purchase amount
    if eligible_amount < discount.min_amount:
        return DiscountValidationResponse(
            valid=False,
            message="Minimum purchase amount not reached.",
            discount_code=discount.code,
            eligible_amount=eligible_amount
        )

    # Check minimum quantity
    if eligible_quantity < discount.min_quantity:
        return DiscountValidationResponse(
            valid=False,
            message="Minimum purchase quantity not reached.",
            discount_code=discount.code,
            eligible_amount=eligible_amount
        )

    # Calculate discount amount
    if discount.discount_type == DiscountType.PERCENTAGE:
        discount_amount = eligible_amount * discount.value / 100
    else:
        discount_amount = discount.value

    # Discount cannot exceed eligible amount
    discount_amount = min(discount_amount, eligible_amount)

    return DiscountValidationResponse(
        valid=True,
        message="Discount applied successfully.",
        discount_code=discount.code,
        discount_amount=round(discount_amount, 2),
        eligible_amount=round(eligible_amount, 2)
    )