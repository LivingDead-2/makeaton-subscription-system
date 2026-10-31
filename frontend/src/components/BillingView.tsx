import React, { useEffect, useState } from "react";
import { api } from "../api";

interface Invoice {
  id: number;
  invoice_number: string;
  subscription_id: number;
  status: string;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  paid_amount: number;
  created_at: string;
}

export const BillingView: React.FC<{ onPaymentSuccess?: () => void }> = ({ onPaymentSuccess }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("CREDIT_CARD");
  const [processing, setProcessing] = useState(false);

  const loadInvoices = () => {
    setLoading(true);
    api.getInvoices()
      .then((data) => {
        setInvoices(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const balanceDue = Number((invoice.grand_total - invoice.paid_amount).toFixed(2));
    setPaymentAmount(balanceDue > 0 ? balanceDue : invoice.grand_total);
  };

  const handleConfirmInvoice = async (id: number) => {
    try {
      await api.confirmInvoice(id);
      loadInvoices();
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err: any) {
      alert(`Failed to confirm invoice: ${err.message}`);
    }
  };

  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setProcessing(true);
    try {
      await api.recordPayment({
        invoice_id: selectedInvoice.id,
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
        reference_note: "Frontend UI Settlement",
      });
      setSelectedInvoice(null);
      loadInvoices();
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err: any) {
      alert(`Payment failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; border: string }> = {
      PAID: { bg: "rgba(52, 211, 153, 0.12)", text: "#34d399", border: "rgba(52, 211, 153, 0.3)" },
      CONFIRMED: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "rgba(251, 191, 36, 0.3)" },
      DRAFT: { bg: "rgba(148, 163, 184, 0.12)", text: "#94a3b8", border: "rgba(148, 163, 184, 0.3)" },
      CANCELLED: { bg: "rgba(248, 113, 113, 0.12)", text: "#f87171", border: "rgba(248, 113, 113, 0.3)" },
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
      <div style={{
        padding: "1.25rem 1.75rem",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc" }}>
            Invoices & Billing History
          </h3>
          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{invoices.length} historical invoices in ledger</span>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ backgroundColor: "#0f172a", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#94a3b8" }}>
            <th style={{ padding: "0.85rem 1.75rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Invoice #</th>
            <th style={{ padding: "0.85rem 1rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Sub ID</th>
            <th style={{ padding: "0.85rem 1rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Status</th>
            <th style={{ padding: "0.85rem 1rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Total Amount</th>
            <th style={{ padding: "0.85rem 1rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Paid</th>
            <th style={{ padding: "0.85rem 1rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Balance</th>
            <th style={{ padding: "0.85rem 1.75rem", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const balance = Number((inv.grand_total - inv.paid_amount).toFixed(2));
            return (
              <tr key={inv.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                <td style={{ padding: "1rem 1.75rem", fontWeight: 600, color: "#818cf8" }}>{inv.invoice_number}</td>
                <td style={{ padding: "1rem 1rem", color: "#94a3b8" }}>#{inv.subscription_id}</td>
                <td style={{ padding: "1rem 1rem" }}>{getStatusBadge(inv.status)}</td>
                <td style={{ padding: "1rem 1rem", color: "#f8fafc", fontWeight: 600 }}>${inv.grand_total.toLocaleString()}</td>
                <td style={{ padding: "1rem 1rem", color: "#34d399", fontWeight: 600 }}>${inv.paid_amount.toLocaleString()}</td>
                <td style={{ padding: "1rem 1rem", fontWeight: 600, color: balance > 0 ? "#f87171" : "#64748b" }}>
                  ${balance.toLocaleString()}
                </td>
                <td style={{ padding: "1rem 1.75rem", textAlign: "right" }}>
                  {inv.status === "DRAFT" && (
                    <button
                      onClick={() => handleConfirmInvoice(inv.id)}
                      style={{
                        padding: "5px 12px",
                        fontSize: "0.78rem",
                        backgroundColor: "rgba(251, 191, 36, 0.15)",
                        color: "#fbbf24",
                        border: "1px solid rgba(251, 191, 36, 0.3)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                    >
                      Post / Confirm
                    </button>
                  )}
                  {inv.status === "CONFIRMED" && balance > 0 && (
                    <button
                      onClick={() => openPaymentModal(inv)}
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
                      Record Payment
                    </button>
                  )}
                  {inv.status === "PAID" && (
                    <span style={{ fontSize: "0.78rem", color: "#34d399", fontWeight: 600 }}>✓ Settled</span>
                  )}
                </td>
              </tr>
            );
          })}
          {invoices.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>
                No invoices registered in the ledger.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Settle Payment Modal */}
      {selectedInvoice && (
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
            width: "400px",
            maxWidth: "90%",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
          }}>
            <h3 style={{ marginTop: 0, color: "#f8fafc", fontSize: "1.2rem" }}>Settle Invoice Payment</h3>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "0.25rem" }}>
              Allocating cash against invoice <b style={{ color: "#818cf8" }}>{selectedInvoice.invoice_number}</b>
            </p>

            <form onSubmit={handleSettlePayment}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>Settlement Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f1f5f9" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>Payment Gateway / Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f1f5f9" }}
                >
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Wire</option>
                  <option value="STRIPE">Stripe</option>
                  <option value="PAYPAL">PayPal</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  style={{ padding: "0.55rem 1.1rem", background: "#334155", color: "#e2e8f0", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  style={{
                    padding: "0.55rem 1.25rem",
                    background: "#059669",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.82rem"
                  }}
                >
                  {processing ? "Settling..." : "Confirm & Reconcile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
