import React, { useState } from "react";
import { DashboardView } from "./components/DashboardView";
import { SubscriptionsView } from "./components/SubscriptionsView";
import { BillingView } from "./components/BillingView";

export function App() {
  const [tokenInput, setTokenInput] = useState(localStorage.getItem("token") || "");
  const [tokenSaved, setTokenSaved] = useState(!!localStorage.getItem("token"));
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      localStorage.setItem("token", tokenInput.trim());
      setTokenSaved(true);
      window.location.reload();
    }
  };

  const handleClearToken = () => {
    localStorage.removeItem("token");
    setTokenInput("");
    setTokenSaved(false);
    window.location.reload();
  };

  const triggerRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0b0f19",
      color: "#e2e8f0",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      paddingBottom: "3rem"
    }}>
      {/* Top Navigation Bar */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px)",
        backgroundColor: "rgba(15, 23, 42, 0.85)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "0.85rem 2.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #6366f1, #3b82f6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 12px rgba(99, 102, 241, 0.4)"
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#f8fafc", letterSpacing: "-0.01em" }}>
              Brightloop
            </div>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 500, letterSpacing: "0.02em" }}>
              REVENUE & SUBSCRIPTION ENGINE
            </div>
          </div>
        </div>

        {/* Auth / Token Area */}
        <form onSubmit={handleSaveToken} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <input
              type="password"
              placeholder="Paste Bearer JWT..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                color: "#f1f5f9",
                borderRadius: "6px",
                padding: "0.45rem 0.85rem",
                fontSize: "0.82rem",
                width: "220px",
                outline: "none"
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              backgroundColor: "#4f46e5",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "0.45rem 0.9rem",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease"
            }}
          >
            {tokenSaved ? "Update Token" : "Save Token"}
          </button>
          {tokenSaved && (
            <button
              type="button"
              onClick={handleClearToken}
              style={{
                backgroundColor: "transparent",
                color: "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "6px",
                padding: "0.45rem 0.8rem",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Disconnect
            </button>
          )}
        </form>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: "1280px", margin: "2rem auto 0 auto", padding: "0 2rem" }} key={refreshKey}>
        <DashboardView />
        <SubscriptionsView onSubscriptionUpdated={triggerRefresh} />
        <BillingView onPaymentSuccess={triggerRefresh} />
      </main>
    </div>
  );
}

export default App;
