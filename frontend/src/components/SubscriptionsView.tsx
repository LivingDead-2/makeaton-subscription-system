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
    const colors: Record<string, { bg: string; text: string }> = {
      ACTIVE: { bg: "#e6f4ea", text: "#137333" },
      DRAFT: { bg: "#f1f3f4", text: "#5f6368" },
      QUOTATION: { bg: "#e8f0fe", text: "#1a73e8" },
      CONFIRMED: { bg: "#fef7e0", text: "#b06000" },
      PAUSED: { bg: "#fce8e6", text: "#c5221f" },
      CLOSED: { bg: "#dadce0", text: "#3c4043" },
    };
    const c = colors[status] || { bg: "#eee", text: "#333" };
    return (
      <span
        style={{
          padding: "3px 8px",
          borderRadius: "12px",
          fontSize: "0.75rem",
          fontWeight: 600,
          backgroundColor: c.bg,
          color: c.text,
        }}
      >
        {status}
      </span>
    );
  };

  if (loading) return <div style={{ padding: "1rem" }}>Loading subscriptions...</div>;
  if (error) return <div style={{ padding: "1rem", color: "#dc3545" }}>Error: {error}</div>;

  return (
    <div style={{ marginTop: "2rem", backgroundColor: "#fff", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e1e4e8" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h3 style={{ margin: 0, color: "#1a1f36" }}>Active & Pending Subscriptions</h3>
          <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>{subscriptions.length} Total</span>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: "0.45rem 1rem",
            backgroundColor: "#0066cc",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          + New Subscription
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e1e4e8", color: "#495057" }}>
            <th style={{ padding: "0.75rem 0.5rem" }}>Sub #</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Customer ID</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Status</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Plan Cycle</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Start Date</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Next Billing</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.id} style={{ borderBottom: "1px solid #f1f3f4" }}>
              <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600, color: "#007bff" }}>
                {sub.subscription_number || sub.sub_number || `SUB-${sub.id}`}
              </td>
              <td style={{ padding: "0.75rem 0.5rem" }}>User #{sub.customer_id}</td>
              <td style={{ padding: "0.75rem 0.5rem" }}>{getStatusBadge(sub.status)}</td>
              <td style={{ padding: "0.75rem 0.5rem" }}>{sub.plan?.billing_cycle || "MONTHLY"}</td>
              <td style={{ padding: "0.75rem 0.5rem" }}>{sub.start_date || "—"}</td>
              <td style={{ padding: "0.75rem 0.5rem" }}>{sub.next_billing_date || "—"}</td>
              <td style={{ padding: "0.75rem 0.5rem" }}>
                {sub.status !== "ACTIVE" && sub.status !== "CLOSED" && (
                  <button
                    onClick={() => handleActivateSub(sub.id)}
                    disabled={actionLoadingId === sub.id}
                    style={{
                      padding: "4px 10px",
                      fontSize: "0.8rem",
                      backgroundColor: "#28a745",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: 600,
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
                      padding: "4px 10px",
                      fontSize: "0.8rem",
                      backgroundColor: "#17a2b8",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: 600,
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
              <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#6c757d" }}>
                No subscriptions registered yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div style={{ background: "#fff", padding: "2rem", borderRadius: "8px", width: "420px", maxWidth: "90%" }}>
            <h3 style={{ marginTop: 0, color: "#1a1f36" }}>Create Subscription</h3>
            <form onSubmit={handleCreateSubscription}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem" }}>Customer ID</label>
                <input
                  type="number"
                  value={customerId}
                  onChange={(e) => setCustomerId(parseInt(e.target.value) || 1)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem" }}>Billing Plan</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(parseInt(e.target.value))}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
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
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem" }}>Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(parseInt(e.target.value))}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem" }}>Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem" }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem", fontSize: "0.85rem", color: "#495057", background: "#f8f9fa", padding: "0.6rem 0.8rem", borderRadius: "4px" }}>
                Estimated Subtotal: <b>${(quantity * unitPrice).toFixed(2)}</b>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "0.5rem 1rem", background: "#f1f3f4", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#0066cc",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {submitting ? "Creating..." : "Create Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
