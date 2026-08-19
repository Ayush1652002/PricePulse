export type ProductData = {
  marketplace: string;
  externalId: string;
  title: string | null;
  price: number | null;
  currency: string;
};

export interface MarketplaceAdapter {
  canHandle(url: string): boolean;
  getProduct(url: string): Promise<ProductData>;
}
