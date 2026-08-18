import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/prisma.js";

const listingSchema = z.object({
  marketplace: z.string().min(1),
  externalId: z.string().min(1),
  url: z.string().url(),
  currentPrice: z.number().positive(),
  currency: z.string().min(1).default("USD"),
  imageUrl: z.string().url().optional(),
});

const createProductSchema = z.object({
  title: z.string().min(1),
  targetPrice: z.number().positive(),
  listings: z.array(listingSchema).min(1),
});

const updateTrackingSchema = z.object({
  targetPrice: z.number().positive().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "STOPPED"]).optional(),
});

function getUserId(req: Request) {
  return (req as any).user.userId as string;
}

export async function createProduct(
  req: Request,
  res: Response
) {
  try {
    console.log("PRODUCT BODY:", req.body); 
    const data = createProductSchema.parse(req.body);
    const userId = getUserId(req);

    const product = await prisma.product.create({
      data: {
        title: data.title,

        listings: {
          create: await Promise.all(
            data.listings.map(async (listing) => {
              const marketplace =
                await prisma.marketplace.upsert({
                  where: {
                    name: listing.marketplace,
                  },
                  update: {},
                  create: {
                    name: listing.marketplace,
                    baseUrl: new URL(
                      listing.url
                    ).origin,
                  },
                });

              return {
                externalId: listing.externalId,
                url: listing.url,
                currentPrice:
                  listing.currentPrice,
                previousPrice: null,
                lowestObservedPrice:
                  listing.currentPrice,
                currency: listing.currency,
                imageUrl:
                  listing.imageUrl ?? null,
                marketplaceId:
                  marketplace.id,

                priceHistory: {
                  create: {
                    price:
                      listing.currentPrice,
                    currency:
                      listing.currency,
                  },
                },
              };
            })
          ),
        },

        trackedProducts: {
          create: {
            userId,
            targetPrice: data.targetPrice,
          },
        },
      },

      include: {
        listings: {
          include: {
            marketplace: true,
            priceHistory: true,
          },
        },
        trackedProducts: true,
      },
    });

    return res.status(201).json({
      message:
        "Product added and tracking started.",
      product,
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

export async function getProducts(
  req: Request,
  res: Response
) {
  try {
    const userId = getUserId(req);

    const products =
      await prisma.trackedProduct.findMany({
        where: {
          userId,
        },
        include: {
          product: {
            include: {
              listings: {
                include: {
                  marketplace: true,
                },
              },
            },
          },
          alert: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      products,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}

export async function getProduct(
  req: Request,
  res: Response
) {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    const tracking =
      await prisma.trackedProduct.findFirst({
        where: {
          userId,
          productId: id,
        },
        include: {
          product: {
            include: {
              listings: {
                include: {
                  marketplace: true,
                  priceHistory: {
                    orderBy: {
                      checkedAt: "desc",
                    },
                  },
                },
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

    return res.status(200).json({
      tracking,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}

export async function updateTracking(
  req: Request,
  res: Response
) {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    const data =
      updateTrackingSchema.parse(req.body);

    const tracking =
      await prisma.trackedProduct.findFirst({
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

    const updated =
      await prisma.trackedProduct.update({
        where: {
          id: tracking.id,
        },
        data,
      });

    return res.status(200).json({
      message: "Tracking updated successfully.",
      tracking: updated,
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

export async function stopTracking(
  req: Request,
  res: Response
) {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    const tracking =
      await prisma.trackedProduct.findFirst({
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

    await prisma.trackedProduct.delete({
      where: {
        id: tracking.id,
      },
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

export async function getPriceHistory(
  req: Request,
  res: Response
) {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    const tracking =
      await prisma.trackedProduct.findFirst({
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

    const history =
      await prisma.priceHistory.findMany({
        where: {
          listing: {
            productId: id,
          },
        },
        include: {
          listing: {
            include: {
              marketplace: true,
            },
          },
        },
        orderBy: {
          checkedAt: "asc",
        },
      });

    return res.status(200).json({
      history,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}