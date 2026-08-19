import { getEbayAccessToken } from "./ebay-token.service.js";
import { getEbayApiBaseUrl } from "./ebay-token.service.js";
import axios from "axios";

function getItemId(url: string) {
  const match = new URL(url).pathname.match(/\/itm\/(\d+)/);

  if (!match) {
    throw new Error("Invalid eBay product URL.");
  }

  return match[1];
}

export async function getEbayProduct(url: string) {
  const itemId = getItemId(url);
  const token = await getEbayAccessToken();
  const baseUrl = getEbayApiBaseUrl();

  const response = await axios.get(
    `${baseUrl}/buy/browse/v1/item/get_item_by_legacy_id`,
    {
      params: {
        legacy_item_id: itemId,
      },
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    }
  );

  const item = response.data;

  return {
    marketplace: "eBay",
    externalId: item.itemId || itemId,
    title: item.title || null,
    price: item.price?.value ? Number(item.price.value) : null,
    currency: item.price?.currency || "USD",
    url: item.itemWebUrl || url,
  };
}