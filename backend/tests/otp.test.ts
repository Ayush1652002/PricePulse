import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import prisma from "../src/config/prisma.js";
import { resetDb } from "./helpers/db.js";
import { createOtpVerification, verifyOtp, resendOtp } from "../src/services/otp.service.js";

const EMAIL = "otp@example.com";

// Pretend the last code was sent a while ago (so the 60-second cooldown has passed).
async function ageLastSend() {
  await prisma.otpVerification.update({
    where: { email: EMAIL },
    data: { lastResentAt: new Date(Date.now() - 61_000) },
  });
}

async function issue() {
  const result = await createOtpVerification(EMAIL, "hashed-pw");
  if (!result.success) throw new Error(result.message);
  return result.otp;
}

describe("OTP service", () => {
  beforeEach(resetDb);

  it("creates a 6-digit code and stores only a keyed hash (not a plain SHA-256)", async () => {
    const otp = await issue();
    expect(otp).toMatch(/^\d{6}$/);

    const record = await prisma.otpVerification.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(record.hashedOtp).not.toBe(otp);
    expect(record.hashedOtp).not.toBe(crypto.createHash("sha256").update(otp).digest("hex"));
  });

  it("verifies the right code once and deletes the record", async () => {
    const otp = await issue();
    const result = await verifyOtp(EMAIL, otp);
    expect(result.success).toBe(true);
    expect(result.hashedPassword).toBe("hashed-pw");
    expect(await prisma.otpVerification.count()).toBe(0);
  });

  it("calling register again right away is blocked by the cooldown", async () => {
    await issue();
    const second = await createOtpVerification(EMAIL, "hashed-pw");
    expect(second.success).toBe(false);
  });

  it("registering again cannot be used to reset the attempt limit", async () => {
    await issue();

    // use up all 5 attempts
    for (let i = 0; i < 5; i++) await verifyOtp(EMAIL, "000000");

    // an immediate re-register is refused, so the counter stays at 5
    const again = await createOtpVerification(EMAIL, "hashed-pw");
    expect(again.success).toBe(false);

    const record = await prisma.otpVerification.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(record.attempts).toBe(5);
  });

  it("limits how many new codes one registration can request", async () => {
    await issue();
    for (let i = 0; i < 3; i++) {
      await ageLastSend();
      const next = await createOtpVerification(EMAIL, "hashed-pw");
      expect(next.success).toBe(true);
    }
    await ageLastSend();
    const blocked = await createOtpVerification(EMAIL, "hashed-pw");
    expect(blocked.success).toBe(false);
  });

  it("locks after 5 wrong guesses, even for the right code, and keeps the record", async () => {
    const otp = await issue();
    for (let i = 0; i < 5; i++) {
      const wrong = await verifyOtp(EMAIL, otp === "000000" ? "111111" : "000000");
      expect(wrong.success).toBe(false);
    }

    const result = await verifyOtp(EMAIL, otp);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too many/i);
    expect(await prisma.otpVerification.count()).toBe(1);
  });

  it("parallel wrong guesses can never exceed the attempt limit", async () => {
    await issue();
    await Promise.all(Array.from({ length: 12 }, () => verifyOtp(EMAIL, "000000")));
    const record = await prisma.otpVerification.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(record.attempts).toBe(5);
  });

  it("resend works after the cooldown and gives a fresh attempt counter", async () => {
    await issue();
    for (let i = 0; i < 3; i++) await verifyOtp(EMAIL, "000000");

    const tooSoon = await resendOtp(EMAIL);
    expect(tooSoon.success).toBe(false);

    await ageLastSend();
    const resent = await resendOtp(EMAIL);
    expect(resent.success).toBe(true);

    const record = await prisma.otpVerification.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(record.attempts).toBe(0);
    expect(record.resendCount).toBe(1);
  });

  it("an expired registration starts fresh", async () => {
    await issue();
    await prisma.otpVerification.update({
      where: { email: EMAIL },
      data: { expiresAt: new Date(Date.now() - 1000), resendCount: 3, attempts: 5 },
    });

    const fresh = await createOtpVerification(EMAIL, "hashed-pw");
    expect(fresh.success).toBe(true);
    const record = await prisma.otpVerification.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(record.resendCount).toBe(0);
    expect(record.attempts).toBe(0);
  });
});
