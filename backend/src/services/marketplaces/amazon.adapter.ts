import * as cheerio from "cheerio";
import type { MarketplaceAdapter, ProductData } from "./types.js";
import {
  cleanAmazonUrl,
  fetchHtml,
  getExternalId,
  isAmazonShortUrl,
  parsePrice,
  parseTitle,
  resolveShortUrl,
} from "./helpers.js";

export class AmazonAdapter implements MarketplaceAdapter {
  canHandle(url: string) {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "amazon.in" || hostname.endsWith(".amazon.in") ||
      hostname === "amazon.com" || hostname.endsWith(".amazon.com");
  }

  async getProduct(url: string): Promise<ProductData> {
    const resolvedUrl = isAmazonShortUrl(url) ? await resolveShortUrl(url) : url;
    const cleanUrl = cleanAmazonUrl(url);
    const $ = cheerio.load(await fetchHtml(cleanUrl));

    return {
      marketplace: "Amazon",
      externalId: getExternalId(cleanUrl, "Amazon"),
      title: parseTitle($),
      price: parsePrice($),
      currency: "INR",
    };
  }
}
