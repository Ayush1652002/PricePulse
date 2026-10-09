import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "../src/config/prisma.js";
import { resetDb } from "./helpers/db.js";

const fetchProductPrice = vi.hoisted(() => vi.fn());
vi.mock("../src/services/marketplace.service.js", () => ({ fetchProductPrice }));
vi.mock("../src/services/push.service.js", () => ({ sendPushNotification: vi.fn(async () => false) }));

import { checkListingPrice } from "../src/services/price.service.js";

async function makeListing(url = "https://www.amazon.in/dp/B0TEST1234") {
  const marketplace = await prisma.marketplace.create({ data: { name: "Amazon", baseUrl: "https://www.amazon.in" } });
  const product = await prisma.product.create({ data: { title: "Thing" } });
  return prisma.productListing.create({
    data: {
      externalId: "B0TEST1234",
      url,
      currentPrice: 1000,
      lowestObservedPrice: 1000,
      currency: "INR",
      productId: product.id,
      marketplaceId: marketplace.id,
    },
  });
}

describe("checkListingPrice", () => {
  beforeEach(async () => {
    await resetDb();
    fetchProductPrice.mockReset();
  });

  it("saves the new price and a history row", async () => {
    const listing = await makeListing();
    fetchProductPrice.mockResolvedValue(850);

    await checkListingPrice(listing.id);

    const updated = await prisma.productListing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(Number(updated.currentPrice)).toBe(850);
    expect(Number(updated.previousPrice)).toBe(1000);
    expect(Number(updated.lowestObservedPrice)).toBe(850);
    expect(await prisma.priceHistory.count()).toBe(1);
  });

  it("THROWS when the price cannot be fetched (so the queue can retry the job)", async () => {
    const listing = await makeListing();
    fetchProductPrice.mockRejectedValue(new Error("blocked by shop"));

    await expect(checkListingPrice(listing.id)).rejects.toThrow("blocked by shop");

    const unchanged = await prisma.productListing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(Number(unchanged.currentPrice)).toBe(1000);
    expect(await prisma.priceHistory.count()).toBe(0);
  });

  it("THROWS when the scraper returns an empty or invalid price", async () => {
    const listing = await makeListing();
    for (const bad of [null, 0, -5, NaN]) {
      fetchProductPrice.mockResolvedValue(bad);
      await expect(checkListingPrice(listing.id)).rejects.toThrow(/invalid/i);
    }
  });

  it("skips (does not fail) listings on shops that cannot be read automatically", async () => {
    const listing = await makeListing("https://example-shop.test/item/1");

    const result = await checkListingPrice(listing.id);

    expect(result.id).toBe(listing.id);
    expect(fetchProductPrice).not.toHaveBeenCalled();
  });

  it("throws for an unknown listing", async () => {
    await expect(checkListingPrice("does-not-exist")).rejects.toThrow(/not found/i);
  });
});
