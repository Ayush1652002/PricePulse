import { Request, Response } from "express";
import { z } from "zod";
import { getProductMeta } from "../services/product-meta.service.js";

const schema = z.object({
  url: z.string().url(),
  marketplace: z.string().optional(),
});

export async function previewProduct(req: Request, res: Response) {
  try {
    const data = schema.parse(req.body);
    const result = await getProductMeta(data.url, data.marketplace);

    console.log("PRODUCT PREVIEW:", result);

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid product URL.",
      });
    }

    console.error(error);

    return res.status(422).json({
      message:
        error instanceof Error
          ? error.message
          : "Could not fetch product details.",
    });
  }
}
