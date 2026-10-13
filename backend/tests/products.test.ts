import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import prisma from "../src/config/prisma.js";
import app from "../src/app.js";
import { resetDb, createUser, amazonListing } from "./helpers/db.js";

const TIMEOUT = 60000;

const add = (cookie: string, body: Record<string, unknown>) =>
  request(app).post("/api/products").set("Cookie", cookie).send(body);

let alice: Awaited<ReturnType<typeof createUser>>;
let bob: Awaited<ReturnType<typeof createUser>>;
let carol: Awaited<ReturnType<typeof createUser>>;
let productId: string;

beforeEach(async () => {
  await resetDb();
  alice = await createUser("alice@example.com");
  bob = await createUser("bob@example.com");
  carol = await createUser("carol@example.com");
}, TIMEOUT);

async function aliceTracks() {
  const res = await add(alice.cookie, { title: "Alice phone", targetPrice: 900, listings: [amazonListing()] });
  expect(res.status).toBe(201);
  productId = res.body.tracking.productId;
}

describe("creating products", () => {
  it("returns the user's own title and creates the data in one go", async () => {
    await aliceTracks();
    const list = await request(app).get("/api/products").set("Cookie", alice.cookie);
    expect(list.body.products).toHaveLength(1);
    expect(list.body.products[0].product.title).toBe("Alice phone");
    expect(await prisma.priceHistory.count()).toBe(1);
  }, TIMEOUT);

  it("the same user adding the same product twice gets 409", async () => {
    await aliceTracks();
    const again = await add(alice.cookie, { title: "Alice phone", targetPrice: 900, listings: [amazonListing()] });
    expect(again.status).toBe(409);
  }, TIMEOUT);

  it("rejects invalid data", async () => {
    const res = await add(alice.cookie, { title: "", targetPrice: -5, listings: [] });
    expect(res.status).toBe(400);
  }, TIMEOUT);
});

describe("shared product data cannot be changed by another user", () => {
  it("a second user adding the same product cannot overwrite the shared title, url or price", async () => {
    await aliceTracks();

    const bobRes = await add(bob.cookie, {
      title: "EVIL TITLE",
      targetPrice: 5000,
      listings: [amazonListing({ url: "https://www.amazon.in/dp/B0TEST1234?evil=1", currentPrice: 1 })],
    });
    expect(bobRes.status).toBe(201);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const listing = await prisma.productListing.findFirstOrThrow({ where: { productId } });
    expect(product.title).toBe("Alice phone");
    expect(Number(listing.currentPrice)).toBe(1000);
    expect(listing.url).toBe("https://www.amazon.in/dp/B0TEST1234");

    const aliceView = await request(app).get("/api/products").set("Cookie", alice.cookie);
    const bobView = await request(app).get("/api/products").set("Cookie", bob.cookie);
    expect(aliceView.body.products[0].product.title).toBe("Alice phone");
    expect(bobView.body.products[0].product.title).toBe("EVIL TITLE"); // Bob only sees his own name
  }, TIMEOUT);

  it("renaming only changes the renaming user's view", async () => {
    await aliceTracks();
    await add(bob.cookie, { title: "Bob phone", targetPrice: 900, listings: [amazonListing()] });

    const res = await request(app).patch(`/api/products/${productId}`).set("Cookie", alice.cookie).send({ title: "Renamed by Alice" });
    expect(res.status).toBe(200);

    const bobView = await request(app).get("/api/products").set("Cookie", bob.cookie);
    expect(bobView.body.products[0].product.title).toBe("Bob phone");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).title).toBe("Alice phone");
  }, TIMEOUT);

  it("manual price edit works for the only tracker", async () => {
    await aliceTracks();
    const res = await request(app).patch(`/api/products/${productId}/price`).set("Cookie", alice.cookie).send({ price: 950, currency: "INR" });
    expect(res.status).toBe(200);
  }, TIMEOUT);

  it("manual price edit is refused (403) when someone else also tracks the product, and sends no alerts", async () => {
    await aliceTracks();
    await add(bob.cookie, { title: "Bob phone", targetPrice: 900, listings: [amazonListing()] });

    const res = await request(app).patch(`/api/products/${productId}/price`).set("Cookie", bob.cookie).send({ price: 1, currency: "INR" });
    expect(res.status).toBe(403);

    const listing = await prisma.productListing.findFirstOrThrow({ where: { productId } });
    expect(Number(listing.currentPrice)).toBe(1000);
    expect(await prisma.notification.count()).toBe(0);
  }, TIMEOUT);
});

describe("one user cannot reach another user's tracking (IDOR)", () => {
  it("returns 404 for a user who does not track the product", async () => {
    await aliceTracks();
    const c = carol.cookie;
    expect((await request(app).get(`/api/products/${productId}`).set("Cookie", c)).status).toBe(404);
    expect((await request(app).patch(`/api/products/${productId}`).set("Cookie", c).send({ targetPrice: 1 })).status).toBe(404);
    expect((await request(app).patch(`/api/products/${productId}/price`).set("Cookie", c).send({ price: 1, currency: "INR" })).status).toBe(404);
    expect((await request(app).delete(`/api/products/${productId}`).set("Cookie", c)).status).toBe(404);
    expect((await request(app).get(`/api/products/${productId}/price-history`).set("Cookie", c)).status).toBe(404);
    expect((await request(app).post(`/api/products/${productId}/check`).set("Cookie", c)).status).toBe(404);
    expect((await request(app).post(`/api/products/${productId}/reset-alert`).set("Cookie", c)).status).toBe(404);

    expect(await prisma.trackedProduct.count()).toBe(1);
  }, TIMEOUT);

  it("deleting removes only the caller's tracking while others still track the product", async () => {
    await aliceTracks();
    await add(bob.cookie, { title: "Bob", targetPrice: 900, listings: [amazonListing()] });

    expect((await request(app).delete(`/api/products/${productId}`).set("Cookie", alice.cookie)).status).toBe(200);
    expect(await prisma.product.count()).toBe(1);

    expect((await request(app).delete(`/api/products/${productId}`).set("Cookie", bob.cookie)).status).toBe(200);
    expect(await prisma.product.count()).toBe(0);
    expect(await prisma.productListing.count()).toBe(0);
  }, TIMEOUT);
});