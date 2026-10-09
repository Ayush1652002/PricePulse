import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/prisma.js";
import { checkTargetPrice } from "../services/alert.service.js";

const listingSchema = z.object({
  marketplace: z.string().min(1),
  externalId: z.string().min(1),
  url: z.string().url(),
  currentPrice: z.number().positive(),
  currency: z.string().min(1).default("INR"),
});

const createProductSchema = z.object({
  title: z.string().min(1),
  targetPrice: z.number().positive(),
  listings: z.array(listingSchema).min(1),
});

const updateTrackingSchema = z.object({
  title: z.string().min(1).optional(),
  targetPrice: z.number().positive().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "STOPPED"]).optional(),
});

function getUserId(req: Request) {
  return (req as any).user.userId as string;
}

// Used by every query that returns a tracking to the user.
const trackingInclude = {
  product: {
    include: {
      listings: {
        include: { marketplace: true },
      },
    },
  },
  alert: true,
} as const;

// Product.title is shared by everyone who tracks the product. The name a user typed is stored
// on their own tracking (customTitle). The API still answers with product.title so the frontend
// needs no change: it simply sees the user's own name.
function withDisplayTitle<T extends { customTitle: string | null; product: { title: string } }>(
  tracking: T
): T {
  return {
    ...tracking,
    product: { ...tracking.product, title: tracking.customTitle ?? tracking.product.title },
  };
}

export async function createProduct(req: Request, res: Response) {
  try {
    const data = createProductSchema.parse(req.body);
    const userId = getUserId(req);

    // Everything below is ONE transaction (all-or-nothing), so a crash cannot leave half-made rows.
    const outcome = await prisma.$transaction(
      async (tx) => {
        let productId: string | null = null;
        const prepared: { input: (typeof data.listings)[number]; marketplaceId: string }[] = [];

        for (const input of data.listings) {
          const marketplace = await tx.marketplace.upsert({
            where: { name: input.marketplace },
            update: {},
            create: {
              name: input.marketplace,
              baseUrl: new URL(input.url).origin,
            },
          });

          prepared.push({ input, marketplaceId: marketplace.id });

          if (!productId) {
            const existingListing = await tx.productListing.findUnique({
              where: {
                marketplaceId_externalId: {
                  marketplaceId: marketplace.id,
                  externalId: input.externalId,
                },
              },
              select: { productId: true },
            });

            if (existingListing) productId = existingListing.productId;
          }
        }

        // If the product already exists, it is SHARED with other users. Its title is never
        // overwritten from user input. (The user's own name goes into customTitle below.)
        const product = productId
          ? await tx.product.findUniqueOrThrow({ where: { id: productId } })
          : await tx.product.create({ data: { title: data.title } });

        for (const { input, marketplaceId } of prepared) {
          const existingListing = await tx.productListing.findUnique({
            where: {
              marketplaceId_externalId: {
                marketplaceId,
                externalId: input.externalId,
              },
            },
            select: { id: true },
          });

          // An existing listing is shared too. Its url / price / currency are only changed by the
          // price checker, never by what a user sends.
          if (existingListing) continue;

          const listing = await tx.productListing.create({
            data: {
              externalId: input.externalId,
              url: input.url,
              currentPrice: input.currentPrice,
              lowestObservedPrice: input.currentPrice,
              currency: input.currency,
              productId: product.id,
              marketplaceId,
            },
          });

          await tx.priceHistory.create({
            data: {
              listingId: listing.id,
              price: input.currentPrice,
              currency: input.currency,
            },
          });
        }

        const existingTracking = await tx.trackedProduct.findUnique({
          where: {
            userId_productId: {
              userId,
              productId: product.id,
            },
          },
        });

        if (existingTracking) {
          if (existingTracking.status !== "STOPPED") {
            return { kind: "conflict" as const };
          }

          const tracking = await tx.trackedProduct.update({
            where: { id: existingTracking.id },
            data: {
              status: "ACTIVE",
              targetPrice: data.targetPrice,
              customTitle: data.title,
            },
            include: trackingInclude,
          });

          return { kind: "restarted" as const, tracking };
        }

        const tracking = await tx.trackedProduct.create({
          data: {
            userId,
            productId: product.id,
            customTitle: data.title,
            targetPrice: data.targetPrice,
            status: "ACTIVE",
          },
          include: trackingInclude,
        });

        return { kind: "created" as const, tracking };
      },
      { maxWait: 10_000, timeout: 20_000 }
    );

    if (outcome.kind === "conflict") {
      return res.status(409).json({
        message: "You are already tracking this product.",
      });
    }

    if (outcome.kind === "restarted") {
      return res.status(200).json({
        message: "Product tracking restarted.",
        tracking: withDisplayTitle(outcome.tracking),
      });
    }

    return res.status(201).json({
      message: "Product added and tracking started.",
      tracking: withDisplayTitle(outcome.tracking),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid product data.",
        errors: error.issues,
      });
    }

    // P2002 = "this row already exists" (two identical requests arrived at the same time).
    if ((error as { code?: string })?.code === "P2002") {
      return res.status(409).json({
        message: "You are already tracking this product.",
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}

export async function getProducts(req: Request, res: Response) {
  try {
    const userId = getUserId(req);

    const products = await prisma.trackedProduct.findMany({
      where: {
        userId,
      },
      include: trackingInclude,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ products: products.map(withDisplayTitle) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}

export async function getProduct(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    const tracking = await prisma.trackedProduct.findFirst({
      where: {
        userId,
        productId: id,
      },
      include: trackingInclude,
    });

    if (!tracking) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    return res.status(200).json({ tracking: withDisplayTitle(tracking) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}

export async function updateTracking(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;
    const data = updateTrackingSchema.parse(req.body);

    const tracking = await prisma.trackedProduct.findFirst({
      where: {
        userId,
        productId: id,
      },
    });

    if (!tracking) {
      return res.status(404).json({
        message: "Tracking record not found.",
      });
    }

    // The new name is saved on THIS user's tracking only (never on the shared Product).
    const updatedTracking = await prisma.trackedProduct.update({
      where: { id: tracking.id },
      data: {
        ...(data.title !== undefined ? { customTitle: data.title } : {}),
        ...(data.targetPrice !== undefined
          ? { targetPrice: data.targetPrice }
          : {}),
        ...(data.status !== undefined
          ? { status: data.status }
          : {}),
      },
      include: trackingInclude,
    });

    return res.status(200).json({
      message: "Tracking updated successfully.",
      tracking: withDisplayTitle(updatedTracking),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid tracking data.",
        errors: error.issues,
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}

export async function deleteTracking(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const productId = req.params.id as string;

    const tracking = await prisma.trackedProduct.findFirst({
      where: {
        userId,
        productId,
      },
    });

    if (!tracking) {
      return res.status(404).json({
        message: "Tracking record not found.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({
        where: {
          alert: {
            trackedProductId: tracking.id,
          },
        },
      });

      await tx.alert.deleteMany({
        where: {
          trackedProductId: tracking.id,
        },
      });

      await tx.trackedProduct.delete({
        where: {
          id: tracking.id,
        },
      });

      const otherTracking = await tx.trackedProduct.count({
        where: {
          productId,
        },
      });

      if (otherTracking === 0) {
        const listings = await tx.productListing.findMany({
          where: {
            productId,
          },
          select: {
            id: true,
          },
        });

        const listingIds = listings.map((listing) => listing.id);

        if (listingIds.length > 0) {
          await tx.priceHistory.deleteMany({
            where: {
              listingId: {
                in: listingIds,
              },
            },
          });

          await tx.productListing.deleteMany({
            where: {
              id: {
                in: listingIds,
              },
            },
          });
        }

        await tx.product.delete({
          where: {
            id: productId,
          },
        });
      }
    });

    return res.status(200).json({
      message: "Product deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to delete product.",
    });
  }
}

export async function getPriceHistory(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    const tracking = await prisma.trackedProduct.findFirst({
      where: {
        userId,
        productId: id,
      },
    });

    if (!tracking) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    const listings = await prisma.productListing.findMany({
      where: { productId: id },
      include: {
        marketplace: true,
        priceHistory: {
          orderBy: { checkedAt: "asc" },
        },
      },
    });

    const history = listings.flatMap((listing) =>
      listing.priceHistory.map((entry) => ({
        id: entry.id,
        price: entry.price,
        currency: entry.currency,
        checkedAt: entry.checkedAt,
        listing: {
          id: listing.id,
          marketplace: {
            id: listing.marketplace.id,
            name: listing.marketplace.name,
            baseUrl: listing.marketplace.baseUrl,
          },
        },
      }))
    );

    history.sort(
      (a, b) =>
        new Date(a.checkedAt).getTime() -
        new Date(b.checkedAt).getTime()
    );

    return res.status(200).json({ history });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}

export async function updatePrice(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    const priceData = z
      .object({
        price: z.number().positive(),
        currency: z.string().min(1),
      })
      .parse(req.body);

    const tracking = await prisma.trackedProduct.findFirst({
      where: {
        userId,
        productId: id,
        status: "ACTIVE",
      },
    });

    if (!tracking) {
      return res.status(404).json({
        message: "Product is not actively tracked.",
      });
    }

    // The listing (and its price) is shared with everyone tracking this product, so a manual
    // price is only allowed while nobody else tracks it. Otherwise one user could trigger
    // fake price-drop alerts for other users.
    const otherTrackers = await prisma.trackedProduct.count({
      where: { productId: id, userId: { not: userId } },
    });

    if (otherTrackers > 0) {
      return res.status(403).json({
        message:
          "This product is also tracked by other users, so its price is updated automatically and cannot be edited manually.",
      });
    }

    const listing = await prisma.productListing.findFirst({
      where: { productId: id },
    });

    if (!listing) {
      return res.status(404).json({
        message: "Product listing not found.",
      });
    }

    const updatedListing = await prisma.productListing.update({
      where: { id: listing.id },
      data: {
        previousPrice: listing.currentPrice,
        currentPrice: priceData.price,
        currency: priceData.currency,
        lastCheckedAt: new Date(),
        lowestObservedPrice:
          Number(priceData.price) <
          Number(listing.lowestObservedPrice)
            ? priceData.price
            : listing.lowestObservedPrice,
      },
      include: {
        marketplace: true,
        product: true,
      },
    });

    await prisma.priceHistory.create({
      data: {
        listingId: listing.id,
        price: priceData.price,
        currency: priceData.currency,
      },
    });
    await checkTargetPrice(listing.id, priceData.price);
    return res.status(200).json({
      message: "Product price updated successfully.",
      listing: updatedListing,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid price data.",
        errors: error.issues,
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}