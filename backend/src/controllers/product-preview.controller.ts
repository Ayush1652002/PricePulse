import { Request, Response } from "express";
import { z } from "zod";
import { detectMarketplace, getProductMeta } from "../services/product-meta.service.js";

const schema = z.object({
  url: z.string().url(),
});

export async function previewProduct(req: Request, res: Response) {
  try {
    const { url } = schema.parse(req.body);

    let result;
    try {
      result = await getProductMeta(url);
    } catch (scrapeError) {
      // Scraping failed (403, unsupported, timeout).
      // Return the detected marketplace + null price so the frontend can
      // auto-select the marketplace dropdown without showing an error alert.
      console.warn("Product preview scrape failed:", scrapeError);

      const marketplace = detectMarketplace(url) ?? "Other";
      result = {
        marketplace,
        externalId: `url-${Buffer.from(url).toString("base64url").slice(0, 40)}`,
        title: null,
        price: null,
        currency: "INR",
      };
    }

    console.log("PRODUCT PREVIEW:", result);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid product URL." });
    }

    console.error("previewProduct unexpected error:", error);
    return res.status(500).json({ message: "Failed to process product URL." });
  }
}