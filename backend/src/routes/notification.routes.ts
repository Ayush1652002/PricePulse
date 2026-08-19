import express from "express";
import { subscribeToPush, getNotifications } from "../controllers/notification.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/subscribe", authenticateToken, subscribeToPush);
router.get("/", authenticateToken, getNotifications);

export default router;