import { Queue } from "bullmq";

export const priceQueue = new Queue("price-check", {
  connection: {
    host: "127.0.0.1",
    port: 6379,
  },
});

export async function addPriceCheckJob(listingId: string) {
  await priceQueue.add("price-check", {
    listingId,
  });
}
