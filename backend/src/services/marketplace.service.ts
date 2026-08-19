import { findMarketplaceAdapter } from "./marketplaces/index.js";

export async function fetchProductPrice(url: string) {
  const adapter = findMarketplaceAdapter(url);

  if (!adapter) {
    throw new Error("This marketplace is not supported for automatic price checks.");
  }

  const product = await adapter.getProduct(url);

  if (product.price === null) {
    throw new Error("Price could not be found. Enter the current price manually.");
  }

  return product.price;
}
