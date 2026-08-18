export type TrackingStatus = "ACTIVE" | "PAUSED" | "STOPPED";

export interface Marketplace {
  id: string;
  name: string;
  baseUrl: string;
}

export interface Product {
  id: string;
  externalId: string;
  title: string;
  url: string;
  imageUrl: string | null;
  currentPrice: string;
  previousPrice: string | null;
  lowestObservedPrice: string;
  currency: string;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  marketplace: Marketplace;
}

export interface Tracking {
  id: string;
  targetPrice: string;
  status: TrackingStatus;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  productId: string;
  product: Product;
  alert?: Alert | null;
}

export interface Alert {
  id: string;
  isBelowTarget: boolean;
  lastTriggeredAt: string | null;
}

export interface PriceHistory {
  id: string;
  price: string;
  currency: string;
  checkedAt: string;
}

export interface ProductInput {
  marketplace: string;
  externalId: string;
  title: string;
  url: string;
  currentPrice: number;
  currency: string;
  targetPrice: number;
}