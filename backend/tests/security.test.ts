import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";

// app.ts reads these settings when it is loaded, so every test loads a fresh copy.
async function freshApp(env: Record<string, string>) {
  vi.resetModules();
  const settings = { REQUIRE_CSRF_HEADER: "false", DISABLE_RATE_LIMIT: "true", ...env };
  for (const [key, value] of Object.entries(settings)) process.env[key] = value;
  return (await import("../src/app.js")).default;
}

describe("security settings", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("adds standard security headers (helmet)", async () => {
    const app = await freshApp({});
    const res = await request(app).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("answers broken JSON with a clean 400", async () => {
    const app = await freshApp({});
    const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid json/i);
  });

  it("blocks too many login attempts (429)", async () => {
    const app = await freshApp({ DISABLE_RATE_LIMIT: "false" });
    let last = 0;
    for (let i = 0; i < 25; i++) {
      last = (await request(app).post("/api/auth/login").send({ email: "a@b.com", password: "wrong-pass" })).status;
    }
    expect(last).toBe(429);
  });

  it("CSRF header: required for changing requests when REQUIRE_CSRF_HEADER=true", async () => {
    const app = await freshApp({ REQUIRE_CSRF_HEADER: "true" });

    const without = await request(app).post("/api/auth/logout");
    expect(without.status).toBe(403);

    const withHeader = await request(app).post("/api/auth/logout").set("X-Requested-With", "pricepulse");
    expect(withHeader.status).toBe(200);

    // reading data is never blocked by this check (it fails later because there is no login cookie)
    const read = await request(app).get("/api/auth/profile");
    expect(read.status).toBe(401);
  });

  it("CSRF header: not enforced by default, so existing frontends keep working", async () => {
    const app = await freshApp({});
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
  });
});
