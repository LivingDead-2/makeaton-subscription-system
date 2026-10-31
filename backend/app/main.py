from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base

# Import all routers
from app.routers import auth, catalog, subscriptions, billing, payments, dashboard

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Brightloop Subscription Management API", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(catalog.router, prefix="/api/catalog", tags=["Catalog & Plans"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["Subscriptions"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing & Invoices"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])

@app.get("/")
def health_check():
    return {"status": "running", "service": "Brightloop Subscription Engine"}