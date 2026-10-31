from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    auth,
    catalog,
    subscriptions,
    billing,
    payments,
    dashboard,
    discounts,
)

app = FastAPI(
    title="Brightloop Subscription Management Platform",
    description="Backend API for managing SaaS product catalog, recurring billing plans, quotes, subscriptions, and lifecycle automation.",
    version="1.0.0",
)

# Enable CORS for Swagger UI and Frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(catalog.router, prefix="/api/catalog", tags=["Catalog & Plans"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["Subscriptions"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing & Invoices"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(discounts.router, prefix="/api/discounts", tags=["Discounts"])


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "online", "platform": "Brightloop"}