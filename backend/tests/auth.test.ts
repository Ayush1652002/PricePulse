import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import prisma from "../src/config/prisma.js";
import { resetDb } from "./helpers/db.js";

// ---- fake Google: lets each test decide what the verified token contains ----
const googlePayload = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    async verifyIdToken() {
      return { getPayload: () => googlePayload.current };
    }
  },
}));

import app from "../src/app.js";

// ---- fake Brevo: captures the OTP that would have been emailed ----
let lastOtp = "";
beforeEach(async () => {
  await resetDb();
  lastOtp = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const html = JSON.parse(init.body).htmlContent as string;
      lastOtp = html.match(/>\s*(\d{6})\s*</)?.[1] ?? "";
      return { ok: true, text: async () => "" };
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

const register = (email = "new@example.com", password = "secret12") =>
  request(app).post("/api/auth/register").send({ email, password });

describe("register + OTP", () => {
  it("sends an OTP, and registering again right away is refused (429)", async () => {
    const first = await register();
    expect(first.status).toBe(200);
    expect(lastOtp).toMatch(/^\d{6}$/);

    const second = await register();
    expect(second.status).toBe(429);
  });

  it("rejects bad input", async () => {
    expect((await register("not-an-email")).status).toBe(400);
    expect((await register("a@b.com", "short")).status).toBe(400);
    expect((await register("a@b.com", "x".repeat(80))).status).toBe(400);
  });

  it("verify-otp validates the body (no crash on numbers)", async () => {
    const res = await request(app).post("/api/auth/verify-otp").send({ email: "a@b.com", otp: 123456 });
    expect(res.status).toBe(400);
  });

  it("wrong code fails; right code creates the account and logs in", async () => {
    await register();
    const wrong = await request(app).post("/api/auth/verify-otp").send({ email: "new@example.com", otp: "000000" });
    expect(wrong.status).toBe(400);

    const ok = await request(app).post("/api/auth/verify-otp").send({ email: "new@example.com", otp: lastOtp });
    expect(ok.status).toBe(201);
    expect(ok.headers["set-cookie"]?.[0]).toMatch(/^token=/);
    expect(ok.headers["set-cookie"]?.[0]).toMatch(/HttpOnly/i);

    const profile = await request(app).get("/api/auth/profile").set("Cookie", ok.headers["set-cookie"]);
    expect(profile.status).toBe(200);
    expect(profile.body.user.email).toBe("new@example.com");
  });
});

describe("login", () => {
  beforeEach(async () => {
    await register();
    await request(app).post("/api/auth/verify-otp").send({ email: "new@example.com", otp: lastOtp });
  });

  it("accepts the right password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "new@example.com", password: "secret12" });
    expect(res.status).toBe(200);
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    const wrong = await request(app).post("/api/auth/login").send({ email: "new@example.com", password: "nope-nope" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "ghost@example.com", password: "secret12" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it("protected routes need the cookie", async () => {
    expect((await request(app).get("/api/products")).status).toBe(401);
    expect((await request(app).get("/api/products").set("Cookie", "token=garbage")).status).toBe(401);
  });
});

describe("Google login", () => {
  it("refuses an unverified Google email", async () => {
    googlePayload.current = { email: "g@example.com", sub: "g-1", email_verified: false };
    const res = await request(app).post("/api/auth/google").send({ credential: "x" });
    expect(res.status).toBe(401);
    expect(await prisma.user.count()).toBe(0);
  });

  it("logs in with a verified Google email", async () => {
    googlePayload.current = { email: "g@example.com", sub: "g-1", email_verified: true, name: "G" };
    const res = await request(app).post("/api/auth/google").send({ credential: "x" });
    expect(res.status).toBe(200);
    expect(await prisma.user.count()).toBe(1);
  });
});
