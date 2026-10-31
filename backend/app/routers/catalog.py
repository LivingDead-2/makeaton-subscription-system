from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, ProductVariant, Plan, User
from app.schemas import (
    ProductCreate, ProductResponse,
    ProductVariantCreate, ProductVariantResponse,
    PlanCreate, PlanResponse
)
from app.routers.auth import require_admin, require_staff_or_admin

router = APIRouter()

# ----------------- Products & Variants -----------------

@router.get("/products", response_model=List[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    """List all available products with variants."""
    return db.query(Product).all()

@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Admin only: Create a product and its optional initial variants."""
    new_product = Product(
        name=payload.name,
        product_type=payload.product_type,
        sales_price=payload.sales_price,
        cost_price=payload.cost_price,
        notes=payload.notes
    )
    db.add(new_product)
    db.flush()

    for variant_data in payload.variants:
        variant = ProductVariant(
            product_id=new_product.id,
            attribute_name=variant_data.attribute_name,
            attribute_value=variant_data.attribute_value,
            price_delta=variant_data.price_delta
        )
        db.add(variant)

    db.commit()
    db.refresh(new_product)
    return new_product

@router.post("/products/{product_id}/variants", response_model=ProductVariantResponse, status_code=status.HTTP_201_CREATED)
def add_product_variant(
    product_id: int,
    payload: ProductVariantCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Admin only: Add a new variant attribute/delta to an existing product."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    variant = ProductVariant(
        product_id=product_id,
        attribute_name=payload.attribute_name,
        attribute_value=payload.attribute_value,
        price_delta=payload.price_delta
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant

# ----------------- Plans -----------------

@router.get("/plans", response_model=List[PlanResponse])
def list_plans(db: Session = Depends(get_db)):
    """Public/Customer: List all recurring plans."""
    return db.query(Plan).all()

@router.post("/plans", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
def create_plan(
    payload: PlanCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Admin only: Create a new billing plan with frequency and rules."""
    new_plan = Plan(
        name=payload.name,
        billing_cycle=payload.billing_cycle,
        price=payload.price,
        min_quantity=payload.min_quantity,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        auto_close_on_expiry=payload.auto_close_on_expiry,
        allow_pause=payload.allow_pause,
        allow_early_close=payload.allow_early_close,
        allow_renewal=payload.allow_renewal
    )
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan
