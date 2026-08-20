import prisma from "../config/prisma.js";
import { fetchProductPrice } from "./marketplace.service.js";
import { checkTargetPrice } from "./alert.service.js";

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
      console.warn(`Price check skipped for listing ${listingId}: Invalid or null price returned.`);
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

    await prisma.priceHistory.create({
      data: {
        listingId,
        price: numericPrice,
        currency: listing.currency || "INR",
      },
    });

    await checkTargetPrice(listingId, numericPrice);

    return updatedListing;
  } catch (error) {
    console.error(`checkListingPrice failed for listing ${listingId}:`, error);
    return listing;
  }
}