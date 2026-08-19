import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import cookieParser from "cookie-parser";
import productRoutes from "./routes/product.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import { createHash } from "crypto";

const app = express();

const EBAY_VERIFICATION_TOKEN = "PricePulse-eBay-Verify-2026";

app.get("/api/ebay/notifications", (req, res) => {
  const challengeCode = req.query.challenge_code as string;

  if (!challengeCode) {
    return res.status(400).json({ message: "Missing challenge code." });
  }

  const endpoint = `${process.env.PUBLIC_API_URL}/api/ebay/notifications`;

  const challengeResponse = createHash("sha256")
    .update(challengeCode)
    .update(EBAY_VERIFICATION_TOKEN)
    .update(endpoint)
    .digest("hex");

  return res.json({ challengeResponse });
});

app.post("/api/ebay/notifications", (req, res) => {
  console.log("eBay notification received:", req.body);
  return res.sendStatus(200);
});

app.use(
   cors({
    origin: [
      "http://localhost:5174",
      "https://price-pulse-silk.vercel.app",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/notifications", notificationRoutes);

export default app;