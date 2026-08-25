import { testRedisConnection } from "../config/redis.js";
import {
  PRICE_CHECK_INTERVAL_MINUTES,
  PRICE_CHECK_INTERVAL_MS,
} from "../config/scheduler.config.js";
import {
  priceQueue,
  queueActiveListingsCheck,
  purgeOldRepeatableJobs,
} from "../queues/price.queue.js";
import prisma from "../config/prisma.js";
import { checkListingPrice } from "../services/price.service.js";

let intervalTimer: NodeJS.Timeout | null = null;
let isBullMQActive = false;

/**
 * Direct price check execution (used in in-memory fallback mode)
 */
export async function runDirectPriceChecks() {
  try {
    const listings = await prisma.productListing.findMany({
      where: {
        product: {
          trackedProducts: {
            some: {
              status: "ACTIVE",
            },
          },
        },
      },
    });

    console.log(
      `[PricePulse Scheduler] Checking ${listings.length} active listings...`
    );

    for (const listing of listings) {
      try {
        await checkListingPrice(listing.id);
      } catch (err: any) {
        console.error(
          `[Price Check Error] Failed for ${listing.url}:`,
          err?.message || err
        );
      }
    }
  } catch (error) {
    console.error("[PricePulse Scheduler Error]:", error);
  }
}

/**
 * Starts BullMQ repeatable scheduler.
 * Guaranteed: Only 1 repeatable schedule registered in Redis.
 */
async function startBullMQScheduler() {
  isBullMQActive = true;

  try {
    // 1. Purge all existing/stale repeatable jobs to prevent zombie schedules
    await purgeOldRepeatableJobs();

    // 2. Register the single master repeatable scheduler with configured interval
    if (typeof (priceQueue as any).upsertJobScheduler === "function") {
      await (priceQueue as any).upsertJobScheduler(
        "pricepulse-master-scheduler",
        { every: PRICE_CHECK_INTERVAL_MS },
        {
          name: "schedule-all-price-checks",
          data: {},
        }
      );
    } else {
      await (priceQueue as any).add(
        "schedule-all-price-checks",
        {},
        {
          repeat: {
            every: PRICE_CHECK_INTERVAL_MS,
          },
          jobId: "pricepulse-master-scheduler",
        }
      );
    }

    console.log(
      `[PricePulse] 🟢 Redis connected! BullMQ Scheduler active (Interval: ${PRICE_CHECK_INTERVAL_MINUTES} min).`
    );
  } catch (error) {
    console.warn(
      "[PricePulse] BullMQ registration failed. Activating in-memory fallback...",
      error
    );
    startFallbackScheduler();
  }
}

/**
 * Starts in-memory setInterval fallback scheduler (strictly if Redis is offline).
 */
function startFallbackScheduler() {
  if (isBullMQActive) return;

  if (intervalTimer) {
    clearInterval(intervalTimer);
  }

  console.log(
    `[PricePulse] 🟡 Redis unavailable. In-Memory Scheduler active (Interval: ${PRICE_CHECK_INTERVAL_MINUTES} min).`
  );

  // Initial check on startup
  runDirectPriceChecks();

  // Repeating check strictly matching the configured interval
  intervalTimer = setInterval(() => {
    runDirectPriceChecks();
  }, PRICE_CHECK_INTERVAL_MS);
}

/**
 * Main Entry Point: Selects BullMQ or In-Memory fallback.
 * Strictly mutually exclusive: never runs both.
 */
export async function startPriceScheduler() {
  const redisAvailable = await testRedisConnection();

  if (redisAvailable) {
    await startBullMQScheduler();
  } else {
    startFallbackScheduler();
  }
}

/**
 * Direct invocation helper
 */
export async function runPriceChecks() {
  if (isBullMQActive) {
    return await queueActiveListingsCheck();
  } else {
    return await runDirectPriceChecks();
  }
}