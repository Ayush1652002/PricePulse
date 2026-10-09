import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes.js";
import cookieParser from "cookie-parser";
import productRoutes from "./routes/product.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import { createHash } from "crypto";
import { apiLimiter } from "./middleware/rateLimit.js";
import { requireCustomHeader } from "./middleware/csrf.middleware.js";

const app = express();

// The app runs behind Render's proxy. This makes req.ip the real visitor IP
// (rate limits would otherwise treat every visitor as the same person).
app.set("trust proxy", 1);

// Adds standard security headers to every response.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// 🟢 Health check for cron-job.org keep-alive
app.get("/", (_req, res) => res.status(200).json({ status: "ok" }));

// Set EBAY_VERIFICATION_TOKEN in the environment. The old value stays as a fallback so eBay
// verification keeps working until you have set it; then you can delete the fallback.
const EBAY_VERIFICATION_TOKEN =
  process.env.EBAY_VERIFICATION_TOKEN || "PricePulse-eBay-Verify-2026";

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

// Extra allowed websites can be added with CLIENT_URL (comma separated), e.g. a custom domain.
const extraOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
   cors({
    origin: [
      "http://localhost:5174",
      "https://price-pulse-silk.vercel.app",
      ...extraOrigins,
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api", apiLimiter);

// CSRF protection. Switch it on with REQUIRE_CSRF_HEADER=true AFTER the updated frontend is live
// (the updated frontend sends the required header on every request).
if (process.env.REQUIRE_CSRF_HEADER === "true") {
  app.use("/api", requireCustomHeader);
}

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/notifications", notificationRoutes);

// Last in the chain: unknown errors (for example broken JSON) get a clean JSON answer.
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ message: "Invalid JSON in request body." });
    }

    console.error("Unhandled error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
);

export default app;