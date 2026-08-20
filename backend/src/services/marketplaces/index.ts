import { AmazonAdapter } from "./amazon.adapter.js";
import { SimpleMarketplaceAdapter } from "./simple.adapter.js";
import type { MarketplaceAdapter } from "./types.js";

export const marketplaceAdapters: MarketplaceAdapter[] = [
  new AmazonAdapter(),
  new SimpleMarketplaceAdapter("Flipkart", ["flipkart.com", "dl.flipkart.com", "fkrt.it"]),
  new SimpleMarketplaceAdapter("Croma", ["croma.com"]),
  new SimpleMarketplaceAdapter("eBay", ["ebay.com", "ebay.in"]),
];

export function findMarketplaceAdapter(url: string): MarketplaceAdapter | undefined {
  if (/^https?:\/\/(www\.)?amzn\.(in|to|com|eu)\/d\//i.test(url)) {
    return marketplaceAdapters.find((adapter) =>
      adapter.canHandle("https://www.amazon.in/dp/B000000000")
    );
  }

  return marketplaceAdapters.find((adapter) => adapter.canHandle(url));
}