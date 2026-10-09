import crypto from "crypto";
import prisma from "../config/prisma.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_RESENDS = 3;

// crypto.randomInt is a secure random generator (Math.random is not meant for secrets).
function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

// HMAC = a hash mixed with a secret key. A plain hash of a 6-digit code can be cracked
// instantly if the table leaks; without the secret key the HMAC cannot be re-computed.
function hashOtp(otp: string): string {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET (or OTP_SECRET) must be set.");
  return crypto.createHmac("sha256", secret).update(otp).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

function secondsLeft(sinceMs: number): number {
  return Math.ceil((RESEND_COOLDOWN_MS - sinceMs) / 1000);
}

export async function createOtpVerification(
  email: string,
  hashedPassword: string
): Promise<{ success: true; otp: string } | { success: false; message: string }> {
  const existing = await prisma.otpVerification.findUnique({ where: { email } });
  const now = Date.now();

  // A pending, not-yet-expired registration: the same cooldown and resend limit as
  // "resend code" apply. This stops people calling /register again and again to get
  // fresh OTP guesses or to spam an email address.
  if (existing && existing.expiresAt.getTime() > now) {
    const lastSent = (existing.lastResentAt ?? existing.createdAt).getTime();

    if (now - lastSent < RESEND_COOLDOWN_MS) {
      return {
        success: false,
        message: `Please wait ${secondsLeft(now - lastSent)} seconds before requesting a new code.`,
      };
    }

    if (existing.resendCount >= MAX_RESENDS) {
      return {
        success: false,
        message: "Too many code requests. Please try again in a few minutes.",
      };
    }
  }

  const otp = generateOtp();
  const hashedOtp = hashOtp(otp);
  const expiresAt = new Date(now + OTP_EXPIRY_MS);
  const stillPending = existing !== null && existing.expiresAt.getTime() > now;

  await prisma.otpVerification.upsert({
    where: { email },
    create: {
      email,
      hashedOtp,
      hashedPassword,
      expiresAt,
      attempts: 0,
      resendCount: 0,
      lastResentAt: new Date(now),
    },
    update: {
      hashedOtp,
      hashedPassword,
      expiresAt,
      attempts: 0,
      // Keep counting while the same registration is still pending, start fresh once it expired.
      resendCount: stillPending ? { increment: 1 } : 0,
      lastResentAt: new Date(now),
    },
  });

  return { success: true, otp };
}

export async function verifyOtp(
  email: string,
  otp: string
): Promise<{ success: boolean; message: string; hashedPassword?: string }> {
  const record = await prisma.otpVerification.findUnique({ where: { email } });

  if (!record) {
    return { success: false, message: "No OTP found for this email. Please register again." };
  }

  if (new Date() > record.expiresAt) {
    await prisma.otpVerification.delete({ where: { email } });
    return { success: false, message: "OTP has expired. Please register again." };
  }

  // Count this guess first, in ONE database step (atomic). If two requests arrive at the same
  // time they cannot both slip under the limit. Nothing is deleted at the limit: the record
  // stays locked until it expires or a new code is issued, so deleting cannot be used to reset it.
  const counted = await prisma.otpVerification.updateMany({
    where: { email, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });

  if (counted.count === 0) {
    return {
      success: false,
      message: "Too many incorrect attempts. Please wait for a new code or try again later.",
    };
  }

  if (!sameHash(hashOtp(otp), record.hashedOtp)) {
    const remaining = Math.max(MAX_ATTEMPTS - record.attempts - 1, 0);
    return {
      success: false,
      message: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
    };
  }

  // OTP is valid — delete the record and return hashedPassword
  await prisma.otpVerification.delete({ where: { email } });
  return { success: true, message: "OTP verified.", hashedPassword: record.hashedPassword };
}

export async function resendOtp(
  email: string
): Promise<{ success: boolean; message: string; otp?: string }> {
  const record = await prisma.otpVerification.findUnique({ where: { email } });

  if (!record) {
    return { success: false, message: "No pending registration found. Please register again." };
  }

  if (new Date() > record.expiresAt) {
    await prisma.otpVerification.delete({ where: { email } });
    return { success: false, message: "OTP session expired. Please register again." };
  }

  // Enforce 60-second cooldown between codes
  const lastSent = (record.lastResentAt ?? record.createdAt).getTime();
  const elapsed = Date.now() - lastSent;
  if (elapsed < RESEND_COOLDOWN_MS) {
    return { success: false, message: `Please wait ${secondsLeft(elapsed)} seconds before resending.` };
  }

  // Enforce max resends per registration
  if (record.resendCount >= MAX_RESENDS) {
    return { success: false, message: "Too many resend requests. Please register again after some time." };
  }

  const otp = generateOtp();

  await prisma.otpVerification.update({
    where: { email },
    data: {
      hashedOtp: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      attempts: 0,
      resendCount: { increment: 1 },
      lastResentAt: new Date(),
    },
  });

  return { success: true, message: "OTP resent.", otp };
}
