import express from "express";
import { registerUser, loginUser,  logoutUser, getProfile } from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {googleLogin} from "../controllers/auth.controller.js"
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google", googleLogin);
router.post("/logout", logoutUser);

router.get("/profile", authenticateToken, getProfile);

export default router;