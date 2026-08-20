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
    return (
      hostname === "amazon.in" ||
      hostname.endsWith(".amazon.in") ||
      hostname === "amazon.com" ||
      hostname.endsWith(".amazon.com")
    );
  }

  async getProduct(url: string): Promise<ProductData> {
    // Step 1: Resolve short URL first (amzn.in/d/... → amazon.in/dp/ASIN)
    const resolvedUrl = isAmazonShortUrl(url) ? await resolveShortUrl(url) : url;

    // Step 2: Clean the RESOLVED URL (not the original short URL)
    // Bug was here: cleanAmazonUrl(url) used original url for short URLs,
    // so ASIN regex failed and cleanUrl remained the short URL.
    const cleanUrl = cleanAmazonUrl(resolvedUrl);

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