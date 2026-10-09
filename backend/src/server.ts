import "dotenv/config";
import { assertRequiredEnv } from "./config/env.js";
import app from "./app.js";
import { startPriceWorker } from "./workers/price.worker.js";
import { startPriceScheduler } from "./workers/price.scheduler.js";

assertRequiredEnv();

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize Worker (if Redis is available)
  await startPriceWorker();

  // Initialize Scheduler (BullMQ if Redis is available, In-Memory fallback otherwise)
  await startPriceScheduler();
});