import * as cheerio from "cheerio";
import type { MarketplaceAdapter, ProductData } from "./types.js";
import { fetchHtml, getExternalId, parsePrice, parseTitle } from "./helpers.js";

export class SimpleMarketplaceAdapter implements MarketplaceAdapter {
  constructor(private name: string, private hosts: string[]) {}

  canHandle(url: string) {
    const hostname = new URL(url).hostname.toLowerCase();
    return this.hosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    );
  }

  async getProduct(url: string): Promise<ProductData> {
    const $ = cheerio.load(await fetchHtml(url));

    return {
      marketplace: this.name,
      externalId: getExternalId(url, this.name),
      title: parseTitle($),
      price: parsePrice($),
      currency: "INR",
    };
  }
}
