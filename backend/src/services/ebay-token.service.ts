import axios from "axios";

let cachedToken: {
  value: string;
  expiresAt: number;
} | null = null;

function getBaseUrl() {
  return process.env.EBAY_ENVIRONMENT === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";
}

export async function getEbayAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("eBay credentials are missing.");
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  try {
    const response = await axios.post(
      `${getBaseUrl()}/identity/v1/oauth2/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const expiresIn = Number(response.data.expires_in);

    cachedToken = {
      value: response.data.access_token,
      expiresAt: Date.now() + Math.max(expiresIn - 60, 60) * 1000,
    };

    return cachedToken.value;
  } catch (error) {
    console.error("eBay authentication failed:", error);
    throw new Error("Could not authenticate with eBay.");
  }
}

export function getEbayApiBaseUrl() {
  return getBaseUrl();
}