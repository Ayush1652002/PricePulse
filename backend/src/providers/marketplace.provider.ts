export interface MarketplaceProduct {
  externalId: string;
  title: string;
  url: string;
  imageUrl?: string;
  currentPrice: number;
  currency: string;
}

export interface MarketplaceProvider {
  searchProducts(query: string): Promise<MarketplaceProduct[]>;
  getProduct(externalId: string): Promise<MarketplaceProduct>;
}