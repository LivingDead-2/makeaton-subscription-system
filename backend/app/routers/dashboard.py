from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Subscription,
    Invoice,
    SubStatus,
    InvoiceStatus,
)
from app.routers.auth import require_staff_or_admin

router = APIRouter()


# --------------------------------------------------
# 1. DASHBOARD FINANCIAL SUMMARY
# --------------------------------------------------

@router.get("/summary")
def get_dashboard_summary(
    start_date: Optional[date] = Query(
        default=None,
        description="Filter records from this date"
    ),
    end_date: Optional[date] = Query(
        default=None,
        description="Filter records up to this date"
    ),
    db: Session = Depends(get_db),
    user=Depends(require_staff_or_admin)
):
    today = date.today()

    # Validate date range.
    if start_date and end_date and start_date > end_date:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=400,
            detail="Start date cannot be later than end date."
        )

    # --------------------------------------------------
    # ACTIVE SUBSCRIPTIONS
    # --------------------------------------------------

    subscription_query = db.query(Subscription).filter(
        Subscription.status == SubStatus.ACTIVE
    )

    if start_date:
        subscription_query = subscription_query.filter(
            Subscription.start_date >= start_date
        )

    if end_date:
        subscription_query = subscription_query.filter(
            Subscription.start_date <= end_date
        )

    active_subscriptions = subscription_query.all()

    active_subscription_count = len(active_subscriptions)

    # --------------------------------------------------
    # MONTHLY RECURRING REVENUE (MRR)
    # --------------------------------------------------

    mrr = 0.0

    for subscription in active_subscriptions:
        plan_price = subscription.plan.price
        billing_cycle = subscription.plan.billing_cycle.value

        if billing_cycle == "DAILY":
            monthly_value = plan_price * 30

        elif billing_cycle == "WEEKLY":
            monthly_value = plan_price * 52 / 12

        elif billing_cycle == "MONTHLY":
            monthly_value = plan_price

        elif billing_cycle == "YEARLY":
            monthly_value = plan_price / 12

        else:
            monthly_value = 0.0

        mrr += monthly_value

    mrr = round(mrr, 2)

    # --------------------------------------------------
    # INVOICE SUMMARY
    # --------------------------------------------------

    invoice_query = db.query(Invoice).filter(
        Invoice.status != InvoiceStatus.CANCELLED
    )

    if start_date:
        invoice_query = invoice_query.filter(
            Invoice.issue_date >= start_date
        )

    if end_date:
        invoice_query = invoice_query.filter(
            Invoice.issue_date <= end_date
        )

    invoices = invoice_query.all()

    total_invoices = len(invoices)

    total_billed = round(
        sum(invoice.grand_total for invoice in invoices), 2
    )

    total_collected = round(
        sum(invoice.paid_amount for invoice in invoices), 2
    )

    # --------------------------------------------------
    # OUTSTANDING BALANCE
    # --------------------------------------------------

    outstanding_balance = round(
        sum(
            max(invoice.grand_total - invoice.paid_amount, 0)
            for invoice in invoices
            if invoice.status != InvoiceStatus.PAID
        ),
        2
    )

    # --------------------------------------------------
    # OVERDUE INVOICES
    # --------------------------------------------------

    overdue_invoices = [
        invoice for invoice in invoices
        if (
            invoice.due_date < today
            and invoice.status not in (
                InvoiceStatus.PAID,
                InvoiceStatus.CANCELLED
            )
            and invoice.grand_total > invoice.paid_amount
        )
    ]

    overdue_invoice_count = len(overdue_invoices)

    overdue_amount = round(
        sum(
            max(invoice.grand_total - invoice.paid_amount, 0)
            for invoice in overdue_invoices
        ),
        2
    )

    # --------------------------------------------------
    # RETURN DASHBOARD SUMMARY
    # --------------------------------------------------

    return {
        "report_date": today,
        "filters": {
            "start_date": start_date,
            "end_date": end_date
        },
        "active_subscriptions": active_subscription_count,
        "monthly_recurring_revenue": mrr,
        "total_invoices": total_invoices,
        "total_billed": total_billed,
        "total_collected": total_collected,
        "outstanding_balance": outstanding_balance,
        "overdue_invoice_count": overdue_invoice_count,
        "overdue_amount": overdue_amount
    }


# --------------------------------------------------
# 2. GET OVERDUE INVOICE DETAILS
# --------------------------------------------------

@router.get("/overdue-invoices")
def get_overdue_invoices(
    db: Session = Depends(get_db),
    user=Depends(require_staff_or_admin)
):
    today = date.today()

    overdue = db.query(Invoice).filter(
        Invoice.due_date < today,
        Invoice.status.notin_([
            InvoiceStatus.PAID,
            InvoiceStatus.CANCELLED
        ]),
        Invoice.grand_total > Invoice.paid_amount
    ).all()

    return {
        "count": len(overdue),
        "total_overdue_amount": round(
            sum(
                max(invoice.grand_total - invoice.paid_amount, 0)
                for invoice in overdue
            ),
            2
        ),
        "invoices": [
            {
                "invoice_id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "customer_id": invoice.customer_id,
                "due_date": invoice.due_date,
                "grand_total": invoice.grand_total,
                "paid_amount": invoice.paid_amount,
                "outstanding_amount": round(
                    invoice.grand_total - invoice.paid_amount, 2
                )
            }
            for invoice in overdue
        ]
    }