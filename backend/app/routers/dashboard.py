from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import (
    Subscription,
    SubStatus,
    Invoice,
    InvoiceStatus,
    Payment,
    User,
    Plan,
    BillingCycle
)
from app.routers.auth import require_staff_or_admin

router = APIRouter()

@router.get("/metrics")
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
) -> Dict[str, Any]:
    """
    Computes real-time SaaS metrics: Active Subscriptions, MRR, ARR, and Cash Flow metrics.
    """
    total_subscriptions = db.query(Subscription).count()
    active_subscriptions = db.query(Subscription).filter(Subscription.status == SubStatus.ACTIVE).count()
    draft_quotations = db.query(Subscription).filter(Subscription.status.in_([SubStatus.DRAFT, SubStatus.QUOTATION])).count()
    closed_subscriptions = db.query(Subscription).filter(Subscription.status == SubStatus.CLOSED).count()

    active_subs = db.query(Subscription).filter(Subscription.status == SubStatus.ACTIVE).all()
    mrr = 0.0

    for sub in active_subs:
        sub_total = 0.0
        for line in sub.lines:
            line_base = line.quantity * line.unit_price
            line_tax = line_base * ((line.tax_percent or 0.0) / 100.0)
            sub_total += (line_base + line_tax)

        cycle = sub.plan.billing_cycle if sub.plan else BillingCycle.MONTHLY
        cycle_str = cycle.value if hasattr(cycle, "value") else str(cycle)

        if cycle_str == "DAILY":
            mrr += (sub_total * 30.0)
        elif cycle_str == "WEEKLY":
            mrr += (sub_total * 4.33)
        elif cycle_str == "MONTHLY":
            mrr += sub_total
        elif cycle_str == "YEARLY":
            mrr += (sub_total / 12.0)

    arr = mrr * 12.0

    total_invoices = db.query(Invoice).count()
    paid_invoices_count = db.query(Invoice).filter(Invoice.status == InvoiceStatus.PAID).count()
    confirmed_invoices_count = db.query(Invoice).filter(Invoice.status == InvoiceStatus.CONFIRMED).count()

    total_billed = db.query(func.coalesce(func.sum(Invoice.grand_total), 0.0)).scalar()
    total_collected = db.query(func.coalesce(func.sum(Invoice.paid_amount), 0.0)).scalar()
    outstanding_balance = round(float(total_billed) - float(total_collected), 2)

    return {
        "subscriptions": {
            "total": total_subscriptions,
            "active": active_subscriptions,
            "draft_quotations": draft_quotations,
            "closed": closed_subscriptions
        },
        "revenue": {
            "mrr": round(mrr, 2),
            "arr": round(arr, 2),
            "currency": "USD"
        },
        "invoices": {
            "total_count": total_invoices,
            "paid_count": paid_invoices_count,
            "confirmed_unpaid_count": confirmed_invoices_count,
            "total_billed": round(float(total_billed), 2),
            "total_collected": round(float(total_collected), 2),
            "outstanding_balance": outstanding_balance
        }
    }
