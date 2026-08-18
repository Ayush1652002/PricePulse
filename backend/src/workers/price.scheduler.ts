import prisma from "../config/prisma.js";
import { checkListingPrice } from "../services/price.service.js";

export async function runPriceChecks() {
  const listings = await prisma.productListing.findMany({
    where: {
      product: {
        trackedProducts: {
          some: {
            status: "ACTIVE",
          },
        },
      },
    },
  });

  for (const listing of listings) {
    try {
      await checkListingPrice(listing.id);

      console.log(
        `Checked: ${listing.marketplaceId} | ${listing.url}`
      );
    } catch (error) {
      console.error(
        `Failed: ${listing.url}`,
        error instanceof Error ? error.message : error
      );
    }
  }
}