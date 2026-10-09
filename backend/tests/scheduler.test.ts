import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Everything outside the scheduler is replaced with fakes: no Redis, no database.
const mocks = vi.hoisted(() => ({
  testRedisConnection: vi.fn(),
  upsertJobScheduler: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("../src/config/redis.js", () => ({ testRedisConnection: mocks.testRedisConnection }));
vi.mock("../src/queues/price.queue.js", () => ({
  priceQueue: { upsertJobScheduler: mocks.upsertJobScheduler },
  queueActiveListingsCheck: vi.fn(),
  purgeOldRepeatableJobs: vi.fn(async () => {}),
}));
vi.mock("../src/config/prisma.js", () => ({
  default: { productListing: { findMany: mocks.findMany } },
}));
vi.mock("../src/services/price.service.js", () => ({ checkListingPrice: vi.fn() }));

async function loadScheduler() {
  vi.resetModules();
  return import("../src/workers/price.scheduler.js");
}

describe("price scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.findMany.mockResolvedValue([]);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses BullMQ (and NOT the in-memory timer) when Redis works", async () => {
    mocks.testRedisConnection.mockResolvedValue(true);
    mocks.upsertJobScheduler.mockResolvedValue(undefined);

    const { startPriceScheduler } = await loadScheduler();
    await startPriceScheduler();

    expect(mocks.upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("uses the in-memory timer when Redis is down", async () => {
    mocks.testRedisConnection.mockResolvedValue(false);

    const { startPriceScheduler } = await loadScheduler();
    await startPriceScheduler();

    expect(mocks.findMany).toHaveBeenCalledTimes(1); // first run starts right away
  });

  it("falls back to the in-memory timer when Redis answers but BullMQ registration fails", async () => {
    mocks.testRedisConnection.mockResolvedValue(true);
    mocks.upsertJobScheduler.mockRejectedValue(new Error("registration failed"));

    const { startPriceScheduler } = await loadScheduler();
    await startPriceScheduler();

    // This was the bug: the fallback never started in this situation.
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
  });
});
