import rateLimit from "express-rate-limit";

// Each limiter counts requests per IP address. Limits are generous for normal use
// and only stop spam / guessing. app.ts sets "trust proxy" so the real IP is used on Render.
function limiter(windowMs: number, limit: number, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message },
    // Lets automated tests turn limits off. Never set this in production.
    skip: () => process.env.DISABLE_RATE_LIMIT === "true",
  });
}

const MIN = 60 * 1000;

export const apiLimiter = limiter(15 * MIN, 1200, "Too many requests. Please slow down.");
export const loginLimiter = limiter(15 * MIN, 20, "Too many login attempts. Try again later.");
export const registerLimiter = limiter(60 * MIN, 10, "Too many sign-up attempts. Try again later.");
export const otpVerifyLimiter = limiter(15 * MIN, 20, "Too many code attempts. Try again later.");
export const otpResendLimiter = limiter(60 * MIN, 10, "Too many code requests. Try again later.");
export const googleLimiter = limiter(15 * MIN, 30, "Too many login attempts. Try again later.");
export const previewLimiter = limiter(10 * MIN, 30, "Too many link checks. Please wait a few minutes.");
export const checkLimiter = limiter(10 * MIN, 30, "Too many price checks. Please wait a few minutes.");
