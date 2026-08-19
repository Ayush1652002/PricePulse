import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/prisma.js";
import EbayProvider from "../providers/ebay.provider.js";
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

export async function createProduct(req: Request, res: Response) {
  try {
    const data = createProductSchema.parse(req.body);
    const userId = getUserId(req);

    /*
     * A Product is the common product entity.
     * A ProductListing identifies the marketplace-specific item.
     * Reuse an existing listing when marketplace + externalId already exists.
     */
    let productId: string | null = null;

    for (const input of data.listings) {
      const marketplace = await prisma.marketplace.upsert({
        where: { name: input.marketplace },
        update: {},
        create: {
          name: input.marketplace,
          baseUrl: new URL(input.url).origin,
        },
      });

      const existingListing = await prisma.productListing.findUnique({
        where: {
          marketplaceId_externalId: {
            marketplaceId: marketplace.id,
            externalId: input.externalId,
          },
        },
        select: {
          id: true,
          productId: true,
        },
      });

      if (existingListing) {
        productId = existingListing.productId;
        break;
      }
    }

    const product = productId
      ? await prisma.product.update({
          where: { id: productId },
          data: { title: data.title },
        })
      : await prisma.product.create({
          data: { title: data.title },
        });

    for (const input of data.listings) {
      const marketplace = await prisma.marketplace.upsert({
        where: { name: input.marketplace },
        update: {},
        create: {
          name: input.marketplace,
          baseUrl: new URL(input.url).origin,
        },
      });

      const existingListing = await prisma.productListing.findUnique({
        where: {
          marketplaceId_externalId: {
            marketplaceId: marketplace.id,
            externalId: input.externalId,
          },
        },
      });

      if (existingListing) {
        await prisma.productListing.update({
          where: { id: existingListing.id },
          data: {
            url: input.url,
            currentPrice: input.currentPrice,
            currency: input.currency,
          },
        });
        continue;
      }

      const listing = await prisma.productListing.create({
        data: {
          externalId: input.externalId,
          url: input.url,
          currentPrice: input.currentPrice,
          lowestObservedPrice: input.currentPrice,
          currency: input.currency,
          productId: product.id,
          marketplaceId: marketplace.id,
        },
      });

      await prisma.priceHistory.create({
        data: {
          listingId: listing.id,
          price: input.currentPrice,
          currency: input.currency,
        },
      });
    }

    const existingTracking = await prisma.trackedProduct.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: product.id,
        },
      },
    });

    if (existingTracking) {
      if (existingTracking.status === "STOPPED") {
        const tracking = await prisma.trackedProduct.update({
          where: { id: existingTracking.id },
          data: {
            status: "ACTIVE",
            targetPrice: data.targetPrice,
          },
          include: {
            product: {
              include: {
                listings: {
                  include: { marketplace: true },
                },
              },
            },
            alert: true,
          },
        });

        return res.status(200).json({
          message: "Product tracking restarted.",
          tracking,
        });
      }

      return res.status(409).json({
        message: "You are already tracking this product.",
      });
    }

    const tracking = await prisma.trackedProduct.create({
      data: {
        userId,
        productId: product.id,
        targetPrice: data.targetPrice,
        status: "ACTIVE",
      },
      include: {
        product: {
          include: {
            listings: {
              include: { marketplace: true },
            },
          },
        },
        alert: true,
      },
    });

    return res.status(201).json({
      message: "Product added and tracking started.",
      tracking,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid product data.",
        errors: error.issues,
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
      include: {
        product: {
          include: {
            listings: {
              include: { marketplace: true },
            },
          },
        },
        alert: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ products });
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
      include: {
        product: {
          include: {
            listings: {
              include: { marketplace: true },
            },
          },
        },
        alert: true,
      },
    });

    if (!tracking) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    return res.status(200).json({ tracking });
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

    if (data.title !== undefined) {
      await prisma.product.update({
        where: { id: tracking.productId },
        data: { title: data.title },
      });
    }

    const updatedTracking = await prisma.trackedProduct.update({
      where: { id: tracking.id },
      data: {
        ...(data.targetPrice !== undefined
          ? { targetPrice: data.targetPrice }
          : {}),
        ...(data.status !== undefined
          ? { status: data.status }
          : {}),
      },
      include: {
        product: {
          include: {
            listings: {
              include: { marketplace: true },
            },
          },
        },
        alert: true,
      },
    });

    return res.status(200).json({
      message: "Tracking updated successfully.",
      tracking: updatedTracking,
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

export async function stopTracking(req: Request, res: Response) {
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
        message: "Tracking record not found.",
      });
    }

    await prisma.trackedProduct.update({
      where: { id: tracking.id },
      data: { status: "STOPPED" },
    });

    return res.status(200).json({
      message: "Product tracking stopped.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error.",
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

export async function searchProducts(req: Request, res: Response) {
  try {
    const query = req.query.q;

    if (typeof query !== "string" || !query.trim()) {
      return res.status(400).json({
        message: "Search query is required.",
      });
    }

    const ebayProvider = new EbayProvider();
    const products = await ebayProvider.searchProducts(query);

    return res.status(200).json({ products });
  } catch (error) {
    console.error(error);
    return res.status(502).json({
      message: "Marketplace provider unavailable.",
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