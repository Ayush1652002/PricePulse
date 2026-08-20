import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getProfile,
  googleLogin,
  verifyOtp,
  resendOtp,
} from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", loginUser);
router.post("/google", googleLogin);
router.post("/logout", logoutUser);

router.get("/profile", authenticateToken, getProfile);

export default router;