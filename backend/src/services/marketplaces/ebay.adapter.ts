import * as cheerio from "cheerio";
import type { MarketplaceAdapter, ProductData } from "./types.js";
import { fetchHtml, getExternalId, parsePrice, parseTitle } from "./helpers.js";

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
    const $ = cheerio.load(await fetchHtml(url));

    return {
      marketplace: "eBay",
      externalId: getExternalId(url, "eBay"),
      title: parseTitle($),
      price: parsePrice($),
      currency: "INR",
    };
  }
}