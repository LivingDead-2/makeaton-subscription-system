import React, { useEffect, useState } from "react";
import { api } from "../api";

interface Metrics {
  monthly_recurring_revenue?: number;
  mrr?: number;
  arr?: number;
  active_subscriptions?: number;
  active_subscribers?: number;
  total_invoices?: number;
  total_billed?: number;
  total_collected?: number;
  total_revenue?: number;
  outstanding_balance?: number;
  overdue_invoice_count?: number;
  overdue_amount?: number;
}

export const DashboardView: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDashboardMetrics()
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "2.5rem", color: "#64748b", fontSize: "0.9rem" }}>
        Loading engine telemetry...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: "1rem 1.5rem",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: "8px",
        color: "#f87171",
        fontSize: "0.88rem"
      }}>
        Telemetry sync failed: {error}
      </div>
    );
  }

  const mrr = metrics?.monthly_recurring_revenue ?? metrics?.mrr ?? 0;
  const arr = metrics?.arr ?? mrr * 12;
  const activeSubs = metrics?.active_subscriptions ?? metrics?.active_subscribers ?? 0;
  const totalCollected = metrics?.total_collected ?? metrics?.total_revenue ?? 0;
  const balance = metrics?.outstanding_balance ?? 0;
  const totalInvoices = metrics?.total_invoices ?? 0;
  const overdueCount = metrics?.overdue_invoice_count ?? 0;

  const cardStyle: React.CSSProperties = {
    flex: "1 1 240px",
    backgroundColor: "#131b2e",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    padding: "1.25rem 1.5rem",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between"
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
      {/* MRR Card */}
      <div style={cardStyle}>
        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Monthly Recurring Revenue
          </span>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#34d399", marginTop: "0.4rem", letterSpacing: "-0.02em" }}>
            ${mrr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
          ARR Run-rate: <span style={{ color: "#cbd5e1", fontWeight: 600 }}>${arr.toLocaleString()}</span>
        </div>
      </div>

      {/* Active Subscribers Card */}
      <div style={cardStyle}>
        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Active Subscribers
          </span>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#60a5fa", marginTop: "0.4rem", letterSpacing: "-0.02em" }}>
            {activeSubs}
          </div>
        </div>
        <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
          Total Invoices Generated: <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{totalInvoices}</span>
        </div>
      </div>

      {/* Total Collected Cash */}
      <div style={cardStyle}>
        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Revenue Collected
          </span>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#38bdf8", marginTop: "0.4rem", letterSpacing: "-0.02em" }}>
            ${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
          Total Billed: <span style={{ color: "#cbd5e1", fontWeight: 600 }}>${(metrics?.total_billed ?? 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Outstanding Receivables */}
      <div style={cardStyle}>
        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Outstanding Receivables
          </span>
          <div style={{
            fontSize: "2rem",
            fontWeight: 700,
            color: balance > 0 ? "#f87171" : "#34d399",
            marginTop: "0.4rem",
            letterSpacing: "-0.02em"
          }}>
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
          {overdueCount > 0 ? (
            <span style={{ color: "#f87171" }}>⚠ {overdueCount} Overdue (${metrics?.overdue_amount ?? 0})</span>
          ) : (
            <span style={{ color: "#34d399" }}>✓ Fully Reconciled</span>
          )}
        </div>
      </div>
    </div>
  );
};
