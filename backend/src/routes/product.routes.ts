import express from "express";
import {
  createProduct,
  getProducts,
  getProduct,
  updateTracking,
  stopTracking,
  deleteTracking,
  getPriceHistory,
   updatePrice,
} from "../controllers/product.controller.js";
import prisma from "../config/prisma.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { checkListingPrice } from "../services/price.service.js";
import { previewProduct } from "../controllers/product-preview.controller.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/", createProduct);
router.get("/", getProducts);
router.post("/preview", previewProduct);
router.get("/:id", getProduct);
router.patch("/:id", updateTracking);
router.patch("/:id/price", updatePrice);
router.delete("/:id", deleteTracking);

router.get("/:id/price-history", getPriceHistory);

router.post("/:id/reset-alert", async (req, res) => {
  try {
    const userId = (req as any).user.userId as string;

    const tracking = await prisma.trackedProduct.findFirst({
      where: {
        productId: req.params.id,
        userId,
      },
    });

    if (!tracking) {
      return res.status(404).json({
        message: "Tracking not found.",
      });
    }

    const alert = await prisma.alert.findUnique({
      where: {
        trackedProductId: tracking.id,
      },
    });

    if (!alert) {
      return res.status(200).json({
        message: "No active alert to reset.",
      });
    }

    await prisma.alert.update({
      where: {
        id: alert.id,
      },
      data: {
        isBelowTarget: false,
        lastTriggeredAt: null,
      },
    });

    return res.status(200).json({
      message: "Alert reset successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to reset alert.",
    });
  }
});

router.post("/:id/check", async (req, res) => {
  try {
    const userId = (req as any).user.userId as string;

    const tracking = await prisma.trackedProduct.findFirst({
      where: {
        productId: req.params.id,
        userId,
        status: "ACTIVE",
      },
    });

    if (!tracking) {
      return res.status(404).json({
        message: "Product is not actively tracked.",
      });
    }

    const listings = await prisma.productListing.findMany({
      where: {
        productId: req.params.id,
      },
    });

    if (listings.length === 0) {
      return res.status(404).json({
        message: "No marketplace listing found.",
      });
    }

    for (const listing of listings) {
      await checkListingPrice(listing.id);
    }

    return res.json({
      message: "Price check completed.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Price check failed.",
    });
  }
});

export default router;