import React, { useEffect, useState } from "react";
import { api } from "../api";

interface Plan {
  id: number;
  name: string;
  billing_cycle: string;
  price: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
}

interface Subscription {
  id: number;
  subscription_number?: string;
  sub_number?: string;
  customer_id: number;
  plan_id: number;
  status: string;
  start_date: string;
  next_billing_date: string;
  plan?: Plan;
}

export const SubscriptionsView: React.FC<{ onSubscriptionUpdated?: () => void }> = ({ onSubscriptionUpdated }) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState<number>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<number>(1);
  const [selectedProductId, setSelectedProductId] = useState<number>(1);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(49.0);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([api.getSubscriptions(), api.getPlans().catch(() => []), api.getProducts().catch(() => [])])
      .then(([subsData, plansData, prodsData]) => {
        setSubscriptions(subsData);
        setPlans(plansData);
        setProducts(prodsData);
        if (plansData.length > 0) setSelectedPlanId(plansData[0].id);
        if (prodsData.length > 0) {
          setSelectedProductId(prodsData[0].id);
          setUnitPrice(Number(prodsData[0].price) || 49.0);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProductChange = (productId: number) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod && typeof prod.price === "number") {
      setUnitPrice(prod.price);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsedQty = Number(quantity) || 1;
      const parsedPrice = Number(unitPrice) || 49.0;
      const computedSubtotal = Number((parsedQty * parsedPrice).toFixed(2));

      const payload = {
        customer_id: Number(customerId),
        plan_id: Number(selectedPlanId),
        lines: [
          {
            product_id: Number(selectedProductId),
            quantity: parsedQty,
            unit_price: parsedPrice,
            subtotal: computedSubtotal,
          },
        ],
      };

      await api.createSubscription(payload);
      setIsModalOpen(false);
      loadData();
      if (onSubscriptionUpdated) onSubscriptionUpdated();
    } catch (err: any) {
      alert(`Creation failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateSub = async (id: number) => {
    setActionLoadingId(id);
    try {
      await api.updateSubscriptionStatus(id, "ACTIVE");
      loadData();
      if (onSubscriptionUpdated) onSubscriptionUpdated();
    } catch (err: any) {
      alert(`Activation failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleGenerateInvoice = async (id: number) => {
    setActionLoadingId(id);
    try {
      await api.generateInvoice(id);
      loadData();
      if (onSubscriptionUpdated) onSubscriptionUpdated();
    } catch (err: any) {
      alert(`Invoice generation failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; border: string }> = {
      ACTIVE: { bg: "rgba(52, 211, 153, 0.12)", text: "#34d399", border: "rgba(52, 211, 153, 0.3)" },
      DRAFT: { bg: "rgba(148, 163, 184, 0.12)", text: "#94a3b8", border: "rgba(148, 163, 184, 0.3)" },
      QUOTATION: { bg: "rgba(96, 165, 250, 0.12)", text: "#60a5fa", border: "rgba(96, 165, 250, 0.3)" },
      CONFIRMED: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "rgba(251, 191, 36, 0.3)" },
      PAUSED: { bg: "rgba(248, 113, 113, 0.12)", text: "#f87171", border: "rgba(248, 113, 113, 0.3)" },
      CLOSED: { bg: "rgba(71, 85, 105, 0.12)", text: "#64748b", border: "rgba(71, 85, 105, 0.3)" },
    };
    const c = config[status] || { bg: "#1e293b", text: "#e2e8f0", border: "#334155" };
    return (
      <span style={{
        padding: "3px 10px",
        borderRadius: "9999px",
        fontSize: "0.74rem",
        fontWeight: 600,
        backgroundColor: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        letterSpacing: "0.02em"
      }}>
        {status}
      </span>
    );
  };

  if (loading) return null;
  if (error) return null;

  return (
    <div style={{
      marginTop: "2rem",
      backgroundColor: "#131b2e",
      borderRadius: "12px",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0,0,0,0.25)"
    }}>
      {/* Header */}
      <div style={{
        padding: "1.25rem 1.75rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)"
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc" }}>
            Active & Pending Subscriptions
          </h3>
          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{subscriptions.length} registered lifecycle contracts</span>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            backgroundColor: "#4f46e5",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "0.45rem 1rem",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)"
          }}
        >
          + New Subscription
        </button>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ backgroundColor: "#0f172a", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#94a3b8" }}>
            <th style={{ padding: "0.85rem 1.75rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Sub ID</th>
            <th style={{ padding: "0.85rem 1rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Customer</th>
            <th style={{ padding: "0.85rem 1rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Status</th>
            <th style={{ padding: "0.85rem 1rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Plan Cadence</th>
            <th style={{ padding: "0.85rem 1rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Start Date</th>
            <th style={{ padding: "0.85rem 1rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Next Billing</th>
            <th style={{ padding: "0.85rem 1.75rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
              <td style={{ padding: "1rem 1.75rem", fontWeight: 600, color: "#818cf8" }}>
                {sub.subscription_number || sub.sub_number || `SUB-${sub.id}`}
              </td>
              <td style={{ padding: "1rem 1rem", color: "#e2e8f0" }}>User #{sub.customer_id}</td>
              <td style={{ padding: "1rem 1rem" }}>{getStatusBadge(sub.status)}</td>
              <td style={{ padding: "1rem 1rem", color: "#94a3b8" }}>{sub.plan?.billing_cycle || "MONTHLY"}</td>
              <td style={{ padding: "1rem 1rem", color: "#94a3b8" }}>{sub.start_date || "—"}</td>
              <td style={{ padding: "1rem 1rem", color: "#94a3b8" }}>{sub.next_billing_date || "—"}</td>
              <td style={{ padding: "1rem 1.75rem", textAlign: "right" }}>
                {sub.status !== "ACTIVE" && sub.status !== "CLOSED" && (
                  <button
                    onClick={() => handleActivateSub(sub.id)}
                    disabled={actionLoadingId === sub.id}
                    style={{
                      padding: "5px 12px",
                      fontSize: "0.78rem",
                      backgroundColor: "rgba(52, 211, 153, 0.15)",
                      color: "#34d399",
                      border: "1px solid rgba(52, 211, 153, 0.3)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    {actionLoadingId === sub.id ? "Activating..." : "Activate"}
                  </button>
                )}
                {sub.status === "ACTIVE" && (
                  <button
                    onClick={() => handleGenerateInvoice(sub.id)}
                    disabled={actionLoadingId === sub.id}
                    style={{
                      padding: "5px 12px",
                      fontSize: "0.78rem",
                      backgroundColor: "rgba(56, 189, 248, 0.15)",
                      color: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    {actionLoadingId === sub.id ? "Generating..." : "⚡ Generate Invoice"}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {subscriptions.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>
                No active subscriptions found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Creation Modal */}
      {isModalOpen && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(4px)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "#1e293b",
            border: "1px solid #334155",
            padding: "2rem",
            borderRadius: "12px",
            width: "440px",
            maxWidth: "90%",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
          }}>
            <h3 style={{ marginTop: 0, color: "#f8fafc", fontSize: "1.2rem" }}>Create Subscription Quotation</h3>
            <form onSubmit={handleCreateSubscription}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>Customer ID</label>
                <input
                  type="number"
                  value={customerId}
                  onChange={(e) => setCustomerId(parseInt(e.target.value) || 1)}
                  style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f1f5f9" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>Billing Plan</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(parseInt(e.target.value))}
                  style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f1f5f9" }}
                >
                  {plans.length > 0 ? (
                    plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.billing_cycle}) - ${p.price}
                      </option>
                    ))
                  ) : (
                    <option value={1}>Standard Monthly ($49)</option>
                  )}
                </select>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(parseInt(e.target.value))}
                  style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f1f5f9" }}
                >
                  {products.length > 0 ? (
                    products.map((prd) => (
                      <option key={prd.id} value={prd.id}>
                        {prd.name} (${prd.price})
                      </option>
                    ))
                  ) : (
                    <option value={1}>Core Suite ($49)</option>
                  )}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginBottom: "1.2rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                    style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f1f5f9" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f1f5f9" }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "0.55rem 1.1rem", background: "#334155", color: "#e2e8f0", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "0.55rem 1.25rem",
                    background: "#4f46e5",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.82rem"
                  }}
                >
                  {submitting ? "Creating..." : "Generate Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
