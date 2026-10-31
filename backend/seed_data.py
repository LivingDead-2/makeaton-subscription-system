from datetime import date
from app.database import SessionLocal, engine, Base
from app.models import User, UserRole, Product, ProductVariant, Plan, BillingCycle, Discount, DiscountType
from app.routers.auth import get_password_hash

# Ensure tables exist
Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()

    # 1. Seed Users (Admin, Staff, Customer)
    users_data = [
        {"name": "Admin User", "email": "admin@brightloop.io", "password": "AdminPassword123!", "role": UserRole.ADMIN},
        {"name": "Staff Alex", "email": "staff@brightloop.io", "password": "StaffPassword123!", "role": UserRole.STAFF},
        {"name": "Customer John", "email": "john@example.com", "password": "CustomerPass123!", "role": UserRole.CUSTOMER},
    ]

    for u in users_data:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            db.add(User(
                name=u["name"],
                email=u["email"],
                hashed_password=get_password_hash(u["password"]),
                role=u["role"]
            ))
            print(f"Created user: {u['email']} ({u['role'].value})")

    # 2. Seed Billing Plans
    plans_data = [
        {
            "name": "Standard Monthly",
            "billing_cycle": BillingCycle.MONTHLY,
            "price": 49.0,
            "min_quantity": 1,
            "allow_pause": True,
            "allow_early_close": True,
            "allow_renewal": True
        },
        {
            "name": "Enterprise Annual",
            "billing_cycle": BillingCycle.YEARLY,
            "price": 499.0,
            "min_quantity": 5,
            "allow_pause": False,
            "allow_early_close": False,
            "allow_renewal": True
        },
        {
            "name": "Sprint Weekly",
            "billing_cycle": BillingCycle.WEEKLY,
            "price": 15.0,
            "min_quantity": 1,
            "allow_pause": True,
            "allow_early_close": True,
            "allow_renewal": False
        }
    ]

    for p in plans_data:
        existing = db.query(Plan).filter(Plan.name == p["name"]).first()
        if not existing:
            db.add(Plan(**p))
            print(f"Created plan: {p['name']}")

    # 3. Seed Products & Variants
    existing_prod = db.query(Product).filter(Product.name == "Brightloop Core Suite").first()
    if not existing_prod:
        prod1 = Product(
            name="Brightloop Core Suite",
            product_type="Software License",
            sales_price=1200.0,
            cost_price=300.0,
            notes="Base enterprise SaaS platform subscription."
        )
        db.add(prod1)
        db.flush()

        # Variants
        v1 = ProductVariant(product_id=prod1.id, attribute_name="Brand", attribute_value="Standard", price_delta=0.0)
        v2 = ProductVariant(product_id=prod1.id, attribute_name="Brand", attribute_value="Odoo", price_delta=560.0)
        db.add_all([v1, v2])
        print("Created product: Brightloop Core Suite with Standard & Odoo (+560) variants")

    existing_prod2 = db.query(Product).filter(Product.name == "Priority Support Add-on").first()
    if not existing_prod2:
        prod2 = Product(
            name="Priority Support Add-on",
            product_type="Service",
            sales_price=250.0,
            cost_price=50.0,
            notes="24/7 SLA-backed technical assistance."
        )
        db.add(prod2)
        print("Created product: Priority Support Add-on")

    # 4. Seed a Discount Code
    existing_disc = db.query(Discount).filter(Discount.code == "LAUNCH20").first()
    if not existing_disc:
        disc = Discount(
            code="LAUNCH20",
            discount_type=DiscountType.PERCENTAGE,
            value=20.0,
            min_amount=100.0,
            min_quantity=1,
            usage_limit=50,
            times_used=0,
            valid_from=date.today()
        )
        db.add(disc)
        print("Created discount rule: LAUNCH20 (20% off)")

    db.commit()
    db.close()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed()
