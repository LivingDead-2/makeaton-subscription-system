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
    const colors: Record<string, { bg: string; text: string }> = {
      PAID: { bg: "#e6f4ea", text: "#137333" },
      CONFIRMED: { bg: "#fef7e0", text: "#b06000" },
      DRAFT: { bg: "#f1f3f4", text: "#5f6368" },
      CANCELLED: { bg: "#fce8e6", text: "#c5221f" },
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

  if (loading) return <div style={{ padding: "1rem" }}>Loading invoices...</div>;
  if (error) return <div style={{ padding: "1rem", color: "#dc3545" }}>Error: {error}</div>;

  return (
    <div style={{ marginTop: "2rem", backgroundColor: "#fff", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e1e4e8" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h3 style={{ margin: 0, color: "#1a1f36" }}>Invoices & Billing History</h3>
          <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>{invoices.length} Total</span>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e1e4e8", color: "#495057" }}>
            <th style={{ padding: "0.75rem 0.5rem" }}>Invoice #</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Sub ID</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Status</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Total Amount</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Paid</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Balance</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const balance = Number((inv.grand_total - inv.paid_amount).toFixed(2));
            return (
              <tr key={inv.id} style={{ borderBottom: "1px solid #f1f3f4" }}>
                <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600, color: "#007bff" }}>{inv.invoice_number}</td>
                <td style={{ padding: "0.75rem 0.5rem" }}>#{inv.subscription_id}</td>
                <td style={{ padding: "0.75rem 0.5rem" }}>{getStatusBadge(inv.status)}</td>
                <td style={{ padding: "0.75rem 0.5rem" }}>${inv.grand_total.toLocaleString()}</td>
                <td style={{ padding: "0.75rem 0.5rem", color: "#137333" }}>${inv.paid_amount.toLocaleString()}</td>
                <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600, color: balance > 0 ? "#c5221f" : "#6c757d" }}>
                  ${balance.toLocaleString()}
                </td>
                <td style={{ padding: "0.75rem 0.5rem" }}>
                  {inv.status === "DRAFT" && (
                    <button
                      onClick={() => handleConfirmInvoice(inv.id)}
                      style={{
                        padding: "4px 8px",
                        fontSize: "0.8rem",
                        backgroundColor: "#6c757d",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Post / Confirm
                    </button>
                  )}
                  {inv.status === "CONFIRMED" && balance > 0 && (
                    <button
                      onClick={() => openPaymentModal(inv)}
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
                      Record Payment
                    </button>
                  )}
                  {inv.status === "PAID" && (
                    <span style={{ fontSize: "0.8rem", color: "#137333", fontWeight: 600 }}>Settled</span>
                  )}
                </td>
              </tr>
            );
          })}
          {invoices.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#6c757d" }}>
                No invoices found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selectedInvoice && (
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
          <div style={{ background: "#fff", padding: "2rem", borderRadius: "8px", width: "380px", maxWidth: "90%" }}>
            <h3 style={{ marginTop: 0 }}>Settle Payment</h3>
            <p style={{ fontSize: "0.85rem", color: "#666" }}>
              Settling invoice <b>{selectedInvoice.invoice_number}</b>
            </p>

            <form onSubmit={handleSettlePayment}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem" }}>Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem" }}>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="STRIPE">Stripe</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  style={{ padding: "0.5rem 1rem", background: "#f1f3f4", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#28a745",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {processing ? "Settling..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
