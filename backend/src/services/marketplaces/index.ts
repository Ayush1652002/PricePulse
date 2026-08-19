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
  return marketplaceAdapters.find((adapter) => adapter.canHandle(url));
}
