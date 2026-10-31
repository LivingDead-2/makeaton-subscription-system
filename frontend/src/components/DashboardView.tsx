import React, { useEffect, useState } from "react";
import { api } from "../api";

interface Metrics {
  subscriptions: {
    total: number;
    active: number;
    draft_quotations: number;
    closed: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    currency: string;
  };
  invoices: {
    total_count: number;
    paid_count: number;
    confirmed_unpaid_count: number;
    total_billed: number;
    total_collected: number;
    outstanding_balance: number;
  };
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

  if (loading) return <div style={{ padding: "2rem" }}>Loading real-time SaaS metrics...</div>;
  if (error) return <div style={{ padding: "2rem", color: "#dc3545" }}>Error loading metrics: {error}</div>;
  if (!metrics) return null;

  return (
    <div style={{ padding: "1rem 0", fontFamily: "sans-serif" }}>
      <h3 style={{ margin: "0 0 1.25rem 0", color: "#1a1f36", fontWeight: 700 }}>
        Subscription & Billing Analytics
      </h3>

      {/* Primary KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
        
        <div style={{ padding: "1.5rem", borderRadius: "8px", background: "#ffffff", border: "1px solid #e1e4e8" }}>
          <h4 style={{ margin: "0 0 0.5rem 0", color: "#6c757d", fontSize: "0.9rem" }}>Monthly Recurring Revenue</h4>
          <h1 style={{ margin: 0, color: "#28a745" }}>${metrics.revenue.mrr.toLocaleString()}</h1>
          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#6c757d" }}>ARR: ${metrics.revenue.arr.toLocaleString()}</p>
        </div>

        <div style={{ padding: "1.5rem", borderRadius: "8px", background: "#ffffff", border: "1px solid #e1e4e8" }}>
          <h4 style={{ margin: "0 0 0.5rem 0", color: "#6c757d", fontSize: "0.9rem" }}>Active Subscribers</h4>
          <h1 style={{ margin: 0, color: "#007bff" }}>{metrics.subscriptions.active}</h1>
          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#6c757d" }}>Total Created: {metrics.subscriptions.total}</p>
        </div>

        <div style={{ padding: "1.5rem", borderRadius: "8px", background: "#ffffff", border: "1px solid #e1e4e8" }}>
          <h4 style={{ margin: "0 0 0.5rem 0", color: "#6c757d", fontSize: "0.9rem" }}>Total Collected</h4>
          <h1 style={{ margin: 0, color: "#17a2b8" }}>${metrics.invoices.total_collected.toLocaleString()}</h1>
          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#6c757d" }}>Paid Invoices: {metrics.invoices.paid_count}</p>
        </div>

        <div style={{ padding: "1.5rem", borderRadius: "8px", background: "#ffffff", border: "1px solid #e1e4e8" }}>
          <h4 style={{ margin: "0 0 0.5rem 0", color: "#6c757d", fontSize: "0.9rem" }}>Outstanding Balance</h4>
          <h1 style={{ margin: 0, color: metrics.invoices.outstanding_balance > 0 ? "#dc3545" : "#6c757d" }}>
            ${metrics.invoices.outstanding_balance.toLocaleString()}
          </h1>
          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#6c757d" }}>Unpaid Invoices: {metrics.invoices.confirmed_unpaid_count}</p>
        </div>

      </div>
    </div>
  );
};
