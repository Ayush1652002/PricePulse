const API_URL = import.meta.env.VITE_API_URL;

async function request(
  url: string,
  options: RequestInit = {}
) {
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

export async function login(
  email: string,
  password: string
) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

export async function googleLogin(
  credential: string
) {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify({
      credential,
    }),
  });
}

export async function register(
  email: string,
  password: string
) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

export async function logout() {
  return request("/auth/logout", {
    method: "POST",
  });
}

export async function getProducts() {
  return request("/products");
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