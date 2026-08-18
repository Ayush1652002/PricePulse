import { Worker } from "bullmq";
import { checkListingPrice } from "../services/price.service.js";

const worker = new Worker(
  "price-check",
  async (job) => {
    return await checkListingPrice(
      job.data.listingId
    );
  },
  {
    connection: {
      host: "localhost",
      port: 6379,
    },
  }
);

worker.on("completed", (job) => {
  console.log(`Price check ${job.id} completed.`);
});

worker.on("failed", (job, error) => {
  console.error(
    `Price check ${job?.id} failed:`,
    error.message
  );
});