const BASE_URL = "http://127.0.0.1:8000/api";

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let msg = errorData.detail;
    if (Array.isArray(msg)) {
      msg = msg.map((e: any) => `${e.loc?.join(".") || "field"}: ${e.msg}`).join(" | ");
    } else if (typeof msg === "object") {
      msg = JSON.stringify(msg);
    }
    throw new Error(msg || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  getDashboardMetrics: () => fetchWithAuth("/dashboard/metrics"),
  getPlans: () => fetchWithAuth("/catalog/plans/"),
  getProducts: () => fetchWithAuth("/catalog/products/"),
  getSubscriptions: () => fetchWithAuth("/subscriptions/"),
  getSubscription: (id: number) => fetchWithAuth(`/subscriptions/${id}`),
  createSubscription: (payload: any) =>
    fetchWithAuth("/subscriptions/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateSubscriptionStatus: (id: number, status: string) =>
    fetchWithAuth(`/subscriptions/${id}/status?new_status=${status}`, {
      method: "PATCH",
    }),

  // Invoices & Billing
  getInvoices: () => fetchWithAuth("/billing/"),
  getInvoice: (id: number) => fetchWithAuth(`/billing/${id}`),
  generateInvoice: (subscriptionId: number) =>
    fetchWithAuth("/billing/generate", {
      method: "POST",
      body: JSON.stringify({ subscription_id: subscriptionId }),
    }),
  confirmInvoice: (id: number) =>
    fetchWithAuth(`/billing/${id}/confirm`, {
      method: "PATCH",
    }),

  // Payments
  recordPayment: (payload: { invoice_id: number; amount: number; payment_method: string; reference_note?: string }) =>
    fetchWithAuth("/payments/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
