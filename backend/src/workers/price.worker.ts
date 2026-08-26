import { Worker } from "bullmq";
import { redisConnection, testRedisConnection } from "../config/redis.js";
import { checkListingPrice } from "../services/price.service.js";
import { queueActiveListingsCheck } from "../queues/price.queue.js";

let workerInstance: Worker | null = null;

export async function startPriceWorker() {
  const isRedisAvailable = await testRedisConnection();
  if (!isRedisAvailable) {
    return null;
  }

  if (!workerInstance) {
    workerInstance = new Worker(
      "price-check",
      async (job) => {
        if (job.name === "schedule-all-price-checks") {
          console.log(
            "[BullMQ Worker] Recurring trigger: checking active listings..."
          );
          return await queueActiveListingsCheck();
        }

        if (!job.data?.listingId) {
          throw new Error("listingId missing from price-check job.");
        }

        // Small stagger to prevent burst rate limits on marketplace scrapers
        await new Promise((resolve) => setTimeout(resolve, 300));

        return await checkListingPrice(job.data.listingId);
      },
      {
        connection: redisConnection,
        concurrency: 3,
      }
    );

    workerInstance.on("completed", (job) => {
      console.log(`[BullMQ Worker] Job ${job.name} (${job.id}) completed.`);
    });

    workerInstance.on("failed", (job, error) => {
      console.error(
        `[BullMQ Worker] Job ${job?.name} (${job?.id}) failed:`,
        error.message
      );
    });

    workerInstance.on("error", (error) => {
      console.error("[BullMQ Worker Error]:", error);
    });
  }

  return workerInstance;
}