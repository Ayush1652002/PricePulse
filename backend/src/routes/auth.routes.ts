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
import {
  loginLimiter,
  registerLimiter,
  otpVerifyLimiter,
  otpResendLimiter,
  googleLimiter,
} from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/register", registerLimiter, registerUser);
router.post("/verify-otp", otpVerifyLimiter, verifyOtp);
router.post("/resend-otp", otpResendLimiter, resendOtp);
router.post("/login", loginLimiter, loginUser);
router.post("/google", googleLimiter, googleLogin);
router.post("/logout", logoutUser);

router.get("/profile", authenticateToken, getProfile);

export default router;