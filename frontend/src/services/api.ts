const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export const API_URL = isLocal
  ? "http://localhost:3000/api"
  : import.meta.env.VITE_API_URL || "https://pricepulse-4h64.onrender.com/api";

async function request(url: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export async function login(email: string, password: string) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function googleLogin(credential: string) {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export async function register(email: string, password: string) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyOtp(email: string, otp: string) {
  return request("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
}

export async function resendOtp(email: string) {
  return request("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function logout() {
  return request("/auth/logout", { method: "POST" });
}

export async function getProfile() {
  return request("/auth/profile");
}

export async function getProducts() {
  return request("/products");
}

export async function previewProduct(url: string, marketplace?: string) {
  return request("/products/preview", {
    method: "POST",
    body: JSON.stringify({
      url,
      marketplace: marketplace || undefined,
    }),
  });
}

export async function createProduct(data: {
  title: string;
  targetPrice: number;
  listings: {
    marketplace: string;
    externalId: string;
    url: string;
    currentPrice: number;
    currency: string;
  }[];
}) {
  return request("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function subscribeToNotifications(
  subscription: PushSubscriptionJSON
) {
  return request("/notifications/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription),
  });
}

export async function updateProduct(
  id: string,
  data: {
    title?: string;
    targetPrice?: number;
    status?: "ACTIVE" | "PAUSED" | "STOPPED";
  }
) {
  return request(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: string) {
  return request(`/products/${id}`, { method: "DELETE" });
}

export async function updateProductPrice(
  id: string,
  price: number,
  currency: string
) {
  return request(`/products/${id}/price`, {
    method: "PATCH",
    body: JSON.stringify({ price, currency }),
  });
}

export async function getPriceHistory(id: string) {
  return request(`/products/${id}/price-history`);
}

export async function checkProductPrice(id: string) {
  return request(`/products/${id}/check`, { method: "POST" });
}

export async function resetAlert(id: string) {
  return request(`/products/${id}/reset-alert`, { method: "POST" });
}

export async function getNotifications() {
  return request("/notifications");
}