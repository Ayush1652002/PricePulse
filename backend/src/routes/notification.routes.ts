import express from "express";
import { subscribeToPush } from "../controllers/notification.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/subscribe", authenticateToken, subscribeToPush);

export default router;