import { AmazonAdapter } from "./amazon.adapter.js";
import { SimpleMarketplaceAdapter } from "./simple.adapter.js";
import type { MarketplaceAdapter } from "./types.js";
import { EbayAdapter } from "./ebay.adapter.js";

export const marketplaceAdapters: MarketplaceAdapter[] = [
  new AmazonAdapter(),
  new SimpleMarketplaceAdapter("Flipkart", ["flipkart.com"]),
  new SimpleMarketplaceAdapter("Meesho", ["meesho.com"]),
  new SimpleMarketplaceAdapter("Croma", ["croma.com"]),
  new EbayAdapter(),
];

export function findMarketplaceAdapter(url: string) {
  // amzn.in short-share URLs (e.g. amzn.in/d/abc123) are Amazon.
  // Route them directly to the Amazon adapter before canHandle() is called,
  // because canHandle() checks the hostname which won't match amazon.in/amazon.com.
  if (/^https?:\/\/(www\.)?amzn\.(in|to|com|eu)\/d\//i.test(url)) {
    return marketplaceAdapters.find((adapter) =>
      adapter.canHandle("https://www.amazon.in/dp/B000000000")
    );
  }
  return marketplaceAdapters.find((adapter) => adapter.canHandle(url));
}
