import express from "express";
import {
  createProduct,
  getProducts,
  getProduct,
  updateTracking,
  stopTracking,
  getPriceHistory,
} from "../controllers/product.controller.js";

import prisma from "../config/prisma.js";

import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/", createProduct);

router.get("/", getProducts);

router.get("/:id", getProduct);

router.patch("/:id", updateTracking);

router.delete("/:id", stopTracking);

router.get(
  "/:id/price-history",
  getPriceHistory
);

router.post("/:id/reset-alert", async (req, res) => {
  try {
    const tracking = await prisma.trackedProduct.findFirst({
      where: {
        productId: req.params.id,
      },
    });

    if (!tracking) {
      return res.status(404).json({
        message: "Tracking not found.",
      });
    }

    await prisma.alert.update({
      where: {
        trackedProductId: tracking.id,
      },
      data: {
        isBelowTarget: false,
        lastTriggeredAt: null,
      },
    });

    res.json({
      message: "Alert reset successfully.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to reset alert.",
    });
  }
});

router.post("/:id/check", async (req, res) => {
  try {
    const { checkListingPrice } = await import(
      "../services/price.service.js"
    );

    const listings = await prisma.productListing.findMany({
      where: {
        productId: req.params.id,
      },
    });

    for (const listing of listings) {
      await checkListingPrice(listing.id);
    }

    res.json({
      message: "Price check completed.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Price check failed.",
    });
  }
});

export default router;