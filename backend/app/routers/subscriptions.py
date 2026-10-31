import uuid
from datetime import date
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Subscription, SubscriptionLine, Product, ProductVariant, Plan, User, SubStatus
from app.schemas import SubscriptionCreate, SubscriptionResponse
from app.routers.auth import get_current_user, require_staff_or_admin

router = APIRouter()

def generate_subscription_number() -> str:
    return f"SUB-{uuid.uuid4().hex[:8].upper()}"

@router.get("/", response_model=List[SubscriptionResponse])
def list_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Staff/Admin view all subscriptions; Customers view only their own."""
    if current_user.role in ["ADMIN", "STAFF"]:
        return db.query(Subscription).all()
    return db.query(Subscription).filter(Subscription.customer_id == current_user.id).all()

@router.post("/", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_subscription(
    payload: SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    """Staff/Admin: Build a new quotation/subscription with calculated line items."""
    plan = db.query(Plan).filter(Plan.id == payload.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Selected plan not found")

    sub_number = generate_subscription_number()
    start_d = payload.start_date or date.today()

    new_sub = Subscription(
        subscription_number=sub_number,
        customer_id=payload.customer_id,
        plan_id=payload.plan_id,
        status=SubStatus.DRAFT,
        start_date=start_d,
        expiry_date=payload.expiry_date,
        payment_terms_days=payload.payment_terms_days,
        applied_discount_id=payload.applied_discount_id,
        next_billing_date=start_d
    )
    db.add(new_sub)
    db.flush()

    for line_in in payload.lines:
        prod = db.query(Product).filter(Product.id == line_in.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product {line_in.product_id} not found")

        unit_p = line_in.unit_price
        if line_in.variant_id:
            variant = db.query(ProductVariant).filter(ProductVariant.id == line_in.variant_id).first()
            if variant:
                unit_p += variant.price_delta

        subtotal = round(unit_p * line_in.quantity, 2)

        line = SubscriptionLine(
            subscription_id=new_sub.id,
            product_id=line_in.product_id,
            variant_id=line_in.variant_id,
            quantity=line_in.quantity,
            unit_price=unit_p,
            tax_percent=line_in.tax_percent,
            subtotal=subtotal
        )
        db.add(line)

    db.commit()
    db.refresh(new_sub)
    return new_sub

@router.patch("/{sub_id}/status", response_model=SubscriptionResponse)
def update_subscription_status(
    sub_id: int,
    new_status: SubStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    """
    Manage lifecycle transitions:
    DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> PAUSED -> CLOSED
    """
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    # Check plan permission toggles
    if new_status == SubStatus.PAUSED and not sub.plan.allow_pause:
        raise HTTPException(status_code=400, detail="Plan policy does not permit pausing")

    if new_status == SubStatus.CLOSED and not sub.plan.allow_early_close:
        today = date.today()
        if sub.expiry_date and today < sub.expiry_date:
            raise HTTPException(status_code=400, detail="Plan policy does not permit early closure")

    sub.status = new_status
    db.commit()
    db.refresh(sub)
    return sub
