import "dotenv/config";
import app from "./app.js";
import { runPriceChecks } from "./workers/price.scheduler.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

setInterval(() => {
  runPriceChecks();
}, 5 * 60 * 1000);