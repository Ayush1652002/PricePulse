import axios from "axios";
import type {
  MarketplaceProduct,
  MarketplaceProvider,
} from "./marketplace.provider.js";

class EbayProvider implements MarketplaceProvider {
  private baseUrl =
    process.env.EBAY_ENVIRONMENT === "production"
      ? "https://api.ebay.com"
      : "https://api.sandbox.ebay.com";

  private async getAccessToken(): Promise<string> {
    const credentials = Buffer.from(
      `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const response = await axios.post(
      `${this.baseUrl}/identity/v1/oauth2/token`,
      "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data.access_token;
  }

  async searchProducts(query: string): Promise<MarketplaceProduct[]> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `${this.baseUrl}/buy/browse/v1/item_summary/search`,
      {
        params: {
          q: query,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return (response.data.itemSummaries ?? []).map((item: any) => ({
      externalId: item.itemId,
      title: item.title,
      url: item.itemWebUrl,
      imageUrl: item.image?.imageUrl,
      currentPrice: Number(item.price?.value),
      currency: item.price?.currency,
    }));
  }

  async getProduct(externalId: string): Promise<MarketplaceProduct> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `${this.baseUrl}/buy/browse/v1/item/${encodeURIComponent(externalId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const item = response.data;

    return {
      externalId: item.itemId,
      title: item.title,
      url: item.itemWebUrl,
      imageUrl: item.image?.imageUrl,
      currentPrice: Number(item.price?.value),
      currency: item.price?.currency,
    };
  }
}

export default EbayProvider;