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
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa", color: "#212529" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 2.5rem",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e1e4e8",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.4rem" }}>⚡</span>
          <h2 style={{ margin: 0, fontWeight: 700, color: "#1a1f36", fontSize: "1.25rem" }}>
            Brightloop Subscription Engine
          </h2>
        </div>

        <form onSubmit={handleSaveToken} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="password"
            placeholder="Paste JWT Bearer Token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{
              padding: "0.45rem 0.8rem",
              borderRadius: "4px",
              border: "1px solid #ced4da",
              width: "250px",
              fontSize: "0.85rem",
              outline: "none"
            }}
          />
          <button
            type="submit"
            style={{
              padding: "0.45rem 0.9rem",
              backgroundColor: "#0066cc",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85rem"
            }}
          >
            {tokenSaved ? "Update Token" : "Set Token"}
          </button>
          {tokenSaved && (
            <button
              type="button"
              onClick={handleClearToken}
              style={{
                padding: "0.45rem 0.85rem",
                backgroundColor: "#dc3545",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem"
              }}
            >
              Logout
            </button>
          )}
        </form>
      </header>

      <main style={{ maxWidth: "1200px", margin: "2rem auto", padding: "0 1.5rem" }} key={refreshKey}>
        <DashboardView />
        <SubscriptionsView onSubscriptionUpdated={triggerRefresh} />
        <BillingView onPaymentSuccess={triggerRefresh} />
      </main>
    </div>
  );
}

export default App;
