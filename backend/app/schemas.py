from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional
from datetime import date, datetime
from enum import Enum

# --- Enums matching models.py ---
class UserRole(str, Enum):
    ADMIN = "ADMIN"
    STAFF = "STAFF"
    CUSTOMER = "CUSTOMER"

class BillingCycle(str, Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"

class SubStatus(str, Enum):
    DRAFT = "DRAFT"
    QUOTATION = "QUOTATION"
    CONFIRMED = "CONFIRMED"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CLOSED = "CLOSED"

class InvoiceStatus(str, Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class DiscountType(str, Enum):
    FIXED = "FIXED"
    PERCENTAGE = "PERCENTAGE"

# --- User & Auth Schemas ---
class UserBase(BaseModel):
    name: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: int
    name: str
    email: str

# --- Product & Variant Schemas ---
class ProductVariantBase(BaseModel):
    attribute_name: str
    attribute_value: str
    price_delta: float = 0.0

class ProductVariantCreate(ProductVariantBase):
    pass

class ProductVariantResponse(ProductVariantBase):
    id: int
    product_id: int

    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    product_type: str
    sales_price: float
    cost_price: float
    notes: Optional[str] = None

class ProductCreate(ProductBase):
    variants: Optional[List[ProductVariantCreate]] = []

class ProductResponse(ProductBase):
    id: int
    variants: List[ProductVariantResponse] = []

    class Config:
        from_attributes = True

# --- Plan Schemas ---
class PlanBase(BaseModel):
    name: str
    billing_cycle: BillingCycle
    price: float
    min_quantity: int = 1
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    auto_close_on_expiry: bool = True
    allow_pause: bool = True
    allow_early_close: bool = True
    allow_renewal: bool = True

class PlanCreate(PlanBase):
    pass

class PlanResponse(PlanBase):
    id: int

    class Config:
        from_attributes = True

# --- Subscription Schemas ---
class SubscriptionLineBase(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = 1
    unit_price: float
    tax_percent: float = 0.0
    subtotal: float

class SubscriptionLineCreate(SubscriptionLineBase):
    pass

class SubscriptionLineResponse(SubscriptionLineBase):
    id: int
    subscription_id: int

    class Config:
        from_attributes = True

class SubscriptionBase(BaseModel):
    customer_id: int
    plan_id: int
    payment_terms_days: int = 15
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None
    applied_discount_id: Optional[int] = None

class SubscriptionCreate(SubscriptionBase):
    lines: List[SubscriptionLineCreate]

class SubscriptionResponse(SubscriptionBase):
    id: int
    subscription_number: str
    status: SubStatus
    start_date: date
    next_billing_date: Optional[date]
    last_billed_date: Optional[date]
    created_at: datetime
    lines: List[SubscriptionLineResponse] = []

    class Config:
        from_attributes = True

# --- Invoice Schemas ---
class InvoiceLineBase(BaseModel):
    product_id: Optional[int] = None
    description: str
    quantity: int
    unit_price: float
    tax_amount: float = 0.0
    line_total: float

class InvoiceLineCreate(InvoiceLineBase):
    pass

class InvoiceLineResponse(InvoiceLineBase):
    id: int
    invoice_id: int

    class Config:
        from_attributes = True

class InvoiceBase(BaseModel):
    subscription_id: Optional[int] = None
    customer_id: int
    due_date: date
    subtotal: float = 0.0
    tax_total: float = 0.0
    discount_total: float = 0.0
    grand_total: float = 0.0

class InvoiceCreate(InvoiceBase):
    lines: List[InvoiceLineCreate]

class InvoiceResponse(InvoiceBase):
    id: int
    invoice_number: str
    status: InvoiceStatus
    issue_date: date
    paid_amount: float
    lines: List[InvoiceLineResponse] = []

    class Config:
        from_attributes = True

# --- Payment Schemas ---
class PaymentCreate(BaseModel):
    invoice_id: int
    payment_method: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    reference_note: Optional[str] = None

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Payment method cannot be empty.")
        return value

class PaymentResponse(BaseModel):
    id: int
    invoice_id: int
    payment_method: str
    amount: float
    payment_date: datetime
    reference_note: Optional[str]

    class Config:
        from_attributes = True

# --- Discount Schemas ---
class DiscountCreate(BaseModel):
    code: str
    discount_type: DiscountType
    value: float = Field(..., gt=0)
    min_amount: float = Field(default=0.0, ge=0)
    min_quantity: int = Field(default=0, ge=0)
    usage_limit: Optional[int] = Field(default=None, gt=0)
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    product_id: Optional[int] = None


class DiscountResponse(BaseModel):
    id: int
    code: str
    discount_type: DiscountType
    value: float
    min_amount: float
    min_quantity: int
    usage_limit: Optional[int]
    times_used: int
    valid_from: Optional[date]
    valid_to: Optional[date]
    product_id: Optional[int]

    class Config:
        from_attributes = True