import enum
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime, 
    ForeignKey, Text, Enum as SQLEnum, Index
)
from sqlalchemy.orm import relationship
from app.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    STAFF = "STAFF"
    CUSTOMER = "CUSTOMER"

class BillingCycle(str, enum.Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"

class SubStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    QUOTATION = "QUOTATION"
    CONFIRMED = "CONFIRMED"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CLOSED = "CLOSED"

class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class DiscountType(str, enum.Enum):
    FIXED = "FIXED"
    PERCENTAGE = "PERCENTAGE"

# 1. Users
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.CUSTOMER, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    subscriptions = relationship("Subscription", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")

# 2. Products & Variants
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    product_type = Column(String(100), nullable=False)
    sales_price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)

    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")

class ProductVariant(Base):
    __tablename__ = "product_variants"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    attribute_name = Column(String(100), nullable=False)
    attribute_value = Column(String(100), nullable=False)
    price_delta = Column(Float, default=0.0)

    product = relationship("Product", back_populates="variants")

# 3. Plans
class Plan(Base):
    __tablename__ = "plans"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    billing_cycle = Column(SQLEnum(BillingCycle), nullable=False)
    price = Column(Float, nullable=False)
    min_quantity = Column(Integer, default=1)
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)
    auto_close_on_expiry = Column(Boolean, default=True)
    allow_pause = Column(Boolean, default=True)
    allow_early_close = Column(Boolean, default=True)
    allow_renewal = Column(Boolean, default=True)

    subscriptions = relationship("Subscription", back_populates="plan")

# 4. Discounts & Taxes
class Discount(Base):
    __tablename__ = "discounts"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    discount_type = Column(SQLEnum(DiscountType), nullable=False)
    value = Column(Float, nullable=False)
    min_amount = Column(Float, default=0.0)
    min_quantity = Column(Integer, default=0)
    usage_limit = Column(Integer, nullable=True)
    times_used = Column(Integer, default=0)
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)

class Tax(Base):
    __tablename__ = "taxes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    rate_percent = Column(Float, nullable=False)

# 5. Quotation Templates
class QuotationTemplate(Base):
    __tablename__ = "quotation_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    validity_days = Column(Integer, default=30)

# 6. Subscriptions
class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    subscription_number = Column(String(100), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    status = Column(SQLEnum(SubStatus), default=SubStatus.DRAFT, nullable=False, index=True)
    start_date = Column(Date, default=date.today, nullable=False)
    expiry_date = Column(Date, nullable=True)
    payment_terms_days = Column(Integer, default=15)
    next_billing_date = Column(Date, nullable=True)
    last_billed_date = Column(Date, nullable=True)
    applied_discount_id = Column(Integer, ForeignKey("discounts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("User", back_populates="subscriptions")
    plan = relationship("Plan", back_populates="subscriptions")
    lines = relationship("SubscriptionLine", back_populates="subscription", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="subscription")

class SubscriptionLine(Base):
    __tablename__ = "subscription_lines"
    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Float, nullable=False)
    tax_percent = Column(Float, default=0.0)
    subtotal = Column(Float, nullable=False)

    subscription = relationship("Subscription", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant")

# 7. Invoices & Payments
class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), unique=True, index=True, nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SQLEnum(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False, index=True)
    issue_date = Column(Date, default=date.today, nullable=False)
    due_date = Column(Date, nullable=False)
    subtotal = Column(Float, default=0.0)
    tax_total = Column(Float, default=0.0)
    discount_total = Column(Float, default=0.0)
    grand_total = Column(Float, default=0.0)
    paid_amount = Column(Float, default=0.0)

    subscription = relationship("Subscription", back_populates="invoices")
    customer = relationship("User", back_populates="invoices")
    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")

class InvoiceLine(Base):
    __tablename__ = "invoice_lines"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    description = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    tax_amount = Column(Float, default=0.0)
    line_total = Column(Float, nullable=False)

    invoice = relationship("Invoice", back_populates="lines")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    payment_method = Column(String(50), nullable=False)
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)
    reference_note = Column(Text, nullable=True)

    invoice = relationship("Invoice", back_populates="payments")

Index("idx_invoice_status_due", Invoice.status, Invoice.due_date)
