import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import cookieParser from "cookie-parser";
import productRoutes from "./routes/product.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

const app = express();

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