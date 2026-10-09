import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import prisma from "../src/config/prisma.js";
import { resetDb, createUser } from "./helpers/db.js";

// No real push messages in tests.
vi.mock("../src/services/push.service.js", () => ({
  sendPushNotification: vi.fn(async () => false),
}));

import { checkTargetPrice } from "../src/services/alert.service.js";

async function setup(target = 1000) {
  const { user } = await createUser("alert@example.com");
  const marketplace = await prisma.marketplace.create({ data: { name: "Amazon", baseUrl: "https://www.amazon.in" } });
  const product = await prisma.product.create({ data: { title: "Shared title" } });
  const listing = await prisma.productListing.create({
    data: {
      externalId: "B0TEST1234",
      url: "https://www.amazon.in/dp/B0TEST1234",
      currentPrice: 1500,
      lowestObservedPrice: 1500,
      currency: "INR",
      productId: product.id,
      marketplaceId: marketplace.id,
    },
  });
  const tracking = await prisma.trackedProduct.create({
    data: { userId: user.id, productId: product.id, targetPrice: target, customTitle: "My own name" },
  });
  return { listing, tracking };
}

const notificationCount = () => prisma.notification.count();
const settle = () => new Promise((resolve) => setTimeout(resolve, 100)); // background sending finishes

describe("checkTargetPrice", () => {
  beforeEach(async () => {
    await resetDb();
    // Never call the real email service in tests.
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "" })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("does nothing while the price is above the target", async () => {
    const { listing } = await setup();
    await checkTargetPrice(listing.id, 1500);
    expect(await notificationCount()).toBe(0);
  });

  it("notifies once when the price reaches the target, not on every check", async () => {
    const { listing } = await setup();
    await checkTargetPrice(listing.id, 999);
    await checkTargetPrice(listing.id, 990);
    await checkTargetPrice(listing.id, 999);
    await settle();
    expect(await notificationCount()).toBe(1);
  });

  it("re-arms when the price goes back up and notifies again on the next drop", async () => {
    const { listing, tracking } = await setup();

    await checkTargetPrice(listing.id, 999);
    expect((await prisma.alert.findUniqueOrThrow({ where: { trackedProductId: tracking.id } })).isBelowTarget).toBe(true);

    await checkTargetPrice(listing.id, 1100);
    expect((await prisma.alert.findUniqueOrThrow({ where: { trackedProductId: tracking.id } })).isBelowTarget).toBe(false);

    await checkTargetPrice(listing.id, 950);
    await settle();
    expect(await notificationCount()).toBe(2);
  });

  it("two price checks at the same moment send only one notification", async () => {
    const { listing } = await setup();
    await Promise.all([checkTargetPrice(listing.id, 999), checkTargetPrice(listing.id, 999), checkTargetPrice(listing.id, 999)]);
    await settle();
    expect(await notificationCount()).toBe(1);
  });

  it("ignores paused trackings", async () => {
    const { listing, tracking } = await setup();
    await prisma.trackedProduct.update({ where: { id: tracking.id }, data: { status: "PAUSED" } });
    await checkTargetPrice(listing.id, 500);
    expect(await notificationCount()).toBe(0);
  });

  it("uses the user's own title in the email", async () => {
    const { listing } = await setup();
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "" }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.BREVO_API_KEY = "test-key";

    await checkTargetPrice(listing.id, 999);
    await settle();
    vi.unstubAllGlobals();

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.subject).toContain("My own name");
    expect(body.subject).not.toContain("Shared title");
  });

  it("escapes HTML in the email body", async () => {
    const { listing, tracking } = await setup();
    await prisma.trackedProduct.update({ where: { id: tracking.id }, data: { customTitle: `<img src=x onerror=alert(1)>` } });
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "" }));
    vi.stubGlobal("fetch", fetchMock);

    await checkTargetPrice(listing.id, 999);
    await settle();
    vi.unstubAllGlobals();

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.htmlContent).not.toContain("<img src=x");
    expect(body.htmlContent).toContain("&lt;img src=x");
  });
});
