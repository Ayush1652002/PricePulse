import crypto from "crypto";
import prisma from "../config/prisma.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_RESENDS_PER_HOUR = 3;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function createOtpVerification(
  email: string,
  hashedPassword: string
): Promise<string> {
  const otp = generateOtp();
  const hashedOtp = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await prisma.otpVerification.upsert({
    where: { email },
    create: {
      email,
      hashedOtp,
      hashedPassword,
      expiresAt,
      attempts: 0,
      resendCount: 0,
    },
    update: {
      hashedOtp,
      hashedPassword,
      expiresAt,
      attempts: 0,
    },
  });

  return otp;
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

  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.otpVerification.delete({ where: { email } });
    return { success: false, message: "Too many incorrect attempts. Please register again." };
  }

  const isValid = hashOtp(otp) === record.hashedOtp;

  if (!isValid) {
    await prisma.otpVerification.update({
      where: { email },
      data: { attempts: record.attempts + 1 },
    });
    const remaining = MAX_ATTEMPTS - record.attempts - 1;
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

  // Enforce 60-second cooldown between resends
  if (record.lastResentAt) {
    const elapsed = Date.now() - record.lastResentAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return { success: false, message: `Please wait ${waitSec} seconds before resending.` };
    }
  }

  // Enforce max 3 resends per hour
  if (record.resendCount >= MAX_RESENDS_PER_HOUR) {
    return { success: false, message: "Too many resend requests. Please register again after some time." };
  }

  const otp = generateOtp();
  const hashedOtp = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await prisma.otpVerification.update({
    where: { email },
    data: {
      hashedOtp,
      expiresAt,
      attempts: 0,
      resendCount: record.resendCount + 1,
      lastResentAt: new Date(),
    },
  });

  return { success: true, message: "OTP resent.", otp };
}