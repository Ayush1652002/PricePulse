import { findMarketplaceAdapter } from "./marketplaces/index.js";

export function detectMarketplace(url: string) {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes("amazon")) return "Amazon";
  if (hostname.includes("flipkart")) return "Flipkart";
  if (hostname.includes("meesho")) return "Meesho";
  if (hostname.includes("croma")) return "Croma";
  if (hostname.includes("ebay")) return "eBay";

  return null;
}

export async function getProductMeta(
  url: string,
  selectedMarketplace?: string
) {
  const detectedMarketplace = detectMarketplace(url);

  if (
    selectedMarketplace &&
    detectedMarketplace &&
    selectedMarketplace.toLowerCase() !== detectedMarketplace.toLowerCase()
  ) {
    throw new Error("Selected marketplace does not match the product URL.");
  }

  const adapter = findMarketplaceAdapter(url);

  if (!adapter) {
    throw new Error(
      "This marketplace is not supported for automatic fetching. Enter the price manually."
    );
  }

  return adapter.getProduct(url);
}
