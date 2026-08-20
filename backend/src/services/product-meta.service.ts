import { findMarketplaceAdapter } from "./marketplaces/index.js";

export function detectMarketplace(url: string): string | null {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes("amazon") || hostname.includes("amzn")) return "Amazon";
  if (hostname.includes("flipkart") || hostname.includes("fkrt")) return "Flipkart";
  if (hostname.includes("croma")) return "Croma";
  if (hostname.includes("ebay")) return "eBay";

  return null;
}

export async function getProductMeta(url: string) {
  const adapter = findMarketplaceAdapter(url);

  if (!adapter) {
    throw new Error(
      "This marketplace is not supported for automatic fetching. Enter the price manually."
    );
  }

  return adapter.getProduct(url);
}