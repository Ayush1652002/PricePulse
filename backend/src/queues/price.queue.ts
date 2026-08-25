import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";
import prisma from "../config/prisma.js";

export const priceQueue = new Queue("price-check", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

/**
 * Removes all old / obsolete repeatable jobs from Redis
 * to guarantee there are never multiple schedulers running in parallel.
 */
export async function purgeOldRepeatableJobs() {
  try {
    const queueAny = priceQueue as any;

    // BullMQ v5 Job Schedulers
    if (typeof queueAny.getJobSchedulers === "function") {
      const schedulers = await queueAny.getJobSchedulers();
      for (const s of schedulers) {
        if (typeof queueAny.removeJobScheduler === "function") {
          await queueAny.removeJobScheduler(s.id || s.key);
          console.log(`[BullMQ Cleanup] Purged old job scheduler: ${s.id || s.key}`);
        }
      }
    }

    // BullMQ v4 Repeatable Jobs
    if (typeof queueAny.getRepeatableJobs === "function") {
      const repeatableJobs = await queueAny.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (typeof queueAny.removeRepeatableByKey === "function") {
          await queueAny.removeRepeatableByKey(job.key);
          console.log(`[BullMQ Cleanup] Purged old repeatable job: ${job.name} (${job.key})`);
        }
      }
    }
  } catch (error) {
    console.warn("[BullMQ Cleanup] Could not purge old repeatable jobs:", error);
  }
}

export async function addPriceCheckJob(listingId: string) {
  const minuteBucket = Math.floor(Date.now() / (60 * 1000));
  return await priceQueue.add(
    "price-check",
    { listingId },
    {
      jobId: `price-check-${listingId}-${minuteBucket}`,
    }
  );
}

export async function queueActiveListingsCheck() {
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
    select: {
      id: true,
      url: true,
      marketplaceId: true,
    },
  });

  if (listings.length === 0) {
    console.log("[BullMQ] No active listings to check.");
    return 0;
  }

  const minuteBucket = Math.floor(Date.now() / (60 * 1000));
  const jobs: any[] = listings.map((listing) => ({
    name: "price-check",
    data: { listingId: listing.id },
    opts: {
      jobId: `price-check-${listing.id}-${minuteBucket}`,
    },
  }));

  await priceQueue.addBulk(jobs);
  console.log(`[BullMQ] Enqueued ${jobs.length} price-check job(s).`);
  return jobs.length;
}