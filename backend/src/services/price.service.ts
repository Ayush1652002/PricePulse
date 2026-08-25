import prisma from "../config/prisma.js";
import { fetchProductPrice } from "./marketplace.service.js";
import { checkTargetPrice } from "./alert.service.js";
import { PRICE_HISTORY_RETENTION } from "../config/retention.config.js";

/**
 * Automatically trims PriceHistory for a listing based on the centralized retention policy.
 * Supports both COUNT (keep latest N records) and DAYS (keep last N days) strategies.
 * Uses the composite index (listingId, checkedAt) for fast, non-blocking execution.
 */
async function trimPriceHistory(listingId: string) {
  try {
    if (PRICE_HISTORY_RETENTION.strategy === "DAYS") {
      // 1. Time-Based Retention Strategy (e.g. keep last 30 days)
      const cutoffDate = new Date(
        Date.now() -
          PRICE_HISTORY_RETENTION.retentionDays * 24 * 60 * 60 * 1000
      );

      await prisma.priceHistory.deleteMany({
        where: {
          listingId,
          checkedAt: {
            lt: cutoffDate,
          },
        },
      });
    } else {
      // 2. Record-Count Retention Strategy (e.g. keep latest 30 records)
      const excessRecords = await prisma.priceHistory.findMany({
        where: { listingId },
        orderBy: { checkedAt: "desc" },
        skip: PRICE_HISTORY_RETENTION.maxRecords,
        select: { id: true },
      });

      if (excessRecords.length > 0) {
        const idsToDelete = excessRecords.map((r) => r.id);
        await prisma.priceHistory.deleteMany({
          where: {
            id: { in: idsToDelete },
          },
        });
      }
    }
  } catch (error) {
    console.warn(
      `[PriceHistory Cleanup] Failed to trim history for listing ${listingId}:`,
      error
    );
  }
}

export async function checkListingPrice(listingId: string) {
  const listing = await prisma.productListing.findUnique({
    where: { id: listingId },
  });

  if (!listing) {
    throw new Error("Listing not found.");
  }

  try {
    const price = await fetchProductPrice(listing.url);

    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      console.warn(
        `Price check skipped for listing ${listingId}: Invalid or null price returned.`
      );
      return listing;
    }

    const numericPrice = Number(price);
    const previousPrice = Number(listing.currentPrice);
    const currentLowest = listing.lowestObservedPrice
      ? Number(listing.lowestObservedPrice)
      : previousPrice;
    const lowestObservedPrice = Math.min(currentLowest, numericPrice);

    const updatedListing = await prisma.productListing.update({
      where: { id: listingId },
      data: {
        previousPrice,
        currentPrice: numericPrice,
        lowestObservedPrice,
        lastCheckedAt: new Date(),
      },
    });

    // 1. Record the new price check in PriceHistory
    await prisma.priceHistory.create({
      data: {
        listingId,
        price: numericPrice,
        currency: listing.currency || "INR",
      },
    });

    // 2. Automatically trim older records based on centralized retention config
    await trimPriceHistory(listingId);

    // 3. Evaluate target-price condition and dispatch alerts (Email + Push)
    await checkTargetPrice(listingId, numericPrice);

    return updatedListing;
  } catch (error) {
    console.error(
      `checkListingPrice failed for listing ${listingId}:`,
      error
    );
    return listing;
  }
}