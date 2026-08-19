import type { MarketplaceAdapter, ProductData } from "./types.js";
import { getEbayProduct } from "../ebay-product.service.js";

export class EbayAdapter implements MarketplaceAdapter {
  canHandle(url: string) {
    const hostname = new URL(url).hostname.toLowerCase();

    return (
      hostname === "ebay.com" ||
      hostname.endsWith(".ebay.com") ||
      hostname === "ebay.in" ||
      hostname.endsWith(".ebay.in")
    );
  }

  async getProduct(url: string): Promise<ProductData> {
    return getEbayProduct(url);
  }
}