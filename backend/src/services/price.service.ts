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

  const price = await fetchProductPrice(listing.url);

  const previousPrice = Number(listing.currentPrice);

  const lowestObservedPrice = Math.min(
    Number(listing.lowestObservedPrice),
    price
  );

  const updatedListing = await prisma.productListing.update({
    where: { id: listingId },
    data: {
      previousPrice,
      currentPrice: price,
      lowestObservedPrice,
      lastCheckedAt: new Date(),
    },
  });

  await checkTargetPrice(listingId, price);

  return updatedListing;
}