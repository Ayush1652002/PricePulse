/**
 * PricePulse URL Fetching Test Suite
 * Run from backend/: npx tsx src/test-fetch.ts
 */

import { findMarketplaceAdapter } from "./services/marketplaces/index.js";

interface TestCase {
  label: string;
  url: string;
  expectedMarketplace: string;
}

const TEST_CASES: TestCase[] = [
  // Amazon — full URL
  {
    label: "Amazon Full URL",
    url: "https://www.amazon.in/Wild-Stone-Perfume-Long-Lasting-Oriental/dp/B0G5GKNL74",
    expectedMarketplace: "Amazon",
  },
  // Amazon — short share URL
  {
    label: "Amazon Short URL",
    url: "https://amzn.in/d/091OpqmB",
    expectedMarketplace: "Amazon",
  },
  // Flipkart — full URL
  {
    label: "Flipkart Full URL",
    url: "https://www.flipkart.com/tecno-pova-curve-2-5g-mystic-purple-128-gb/p/itm1160d6853298d?pid=MOBHK67SYBZBUMKW",
    expectedMarketplace: "Flipkart",
  },
  // Flipkart — short share URL
  {
    label: "Flipkart Short URL",
    url: "https://dl.flipkart.com/s/otkxZtuuuN",
    expectedMarketplace: "Flipkart",
  },
  // Croma — full URL
  {
    label: "Croma Full URL",
    url: "https://www.croma.com/vivo-x300-fe-5g-12gb-ram-256gb-noir-black-/p/322887",
    expectedMarketplace: "Croma",
  },
  // eBay — full URL
  {
    label: "eBay Full URL",
    url: "https://www.ebay.com/itm/134789529321",
    expectedMarketplace: "eBay",
  },
];

type Status = "PASS" | "FAIL" | "WARN";

interface TestResult {
  label: string;
  url: string;
  status: Status;
  marketplace: string;
  price: number | null;
  error?: string;
  durationMs: number;
}

async function runTest(tc: TestCase): Promise<TestResult> {
  const start = Date.now();

  try {
    const adapter = findMarketplaceAdapter(tc.url);
    if (!adapter) {
      return {
        label: tc.label,
        url: tc.url,
        status: "FAIL",
        marketplace: "",
        price: null,
        error: "No adapter found for URL",
        durationMs: Date.now() - start,
      };
    }

    const data = await adapter.getProduct(tc.url);

    const marketplaceMatch = data.marketplace === tc.expectedMarketplace;
    const hasPrice = data.price !== null && data.price > 0;

    const status: Status = !marketplaceMatch
      ? "FAIL"
      : !hasPrice
      ? "WARN"
      : "PASS";

    return {
      label: tc.label,
      url: tc.url,
      status,
      marketplace: data.marketplace,
      price: data.price,
      error: !marketplaceMatch
        ? `Expected ${tc.expectedMarketplace}, got ${data.marketplace}`
        : !hasPrice
        ? "Marketplace detected but price not scraped"
        : undefined,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      label: tc.label,
      url: tc.url,
      status: "FAIL",
      marketplace: "",
      price: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

const icon: Record<Status, string> = {
  PASS: "✅",
  FAIL: "❌",
  WARN: "⚠️ ",
};

async function main() {
  console.log("\n🧪 PricePulse URL Fetch Test Suite\n" + "=".repeat(50));

  const results: TestResult[] = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`  Testing: ${tc.label}... `);
    const result = await runTest(tc);
    results.push(result);
    console.log(`${icon[result.status]} (${result.durationMs}ms)`);
    if (result.error) console.log(`     └─ ${result.error}`);
    if (result.price) console.log(`     └─ Price: ₹${result.price}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary\n");

  const pass = results.filter((r) => r.status === "PASS").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const fail = results.filter((r) => r.status === "FAIL").length;

  for (const r of results) {
    console.log(
      `  ${icon[r.status]} ${r.label.padEnd(28)} Marketplace: ${
        r.marketplace || "—"
      }  Price: ${r.price ? `₹${r.price}` : "NOT FETCHED"}`
    );
  }

  console.log(`\n  Total: ${pass} PASS  ${warn} WARN (marketplace ok, price blocked)  ${fail} FAIL\n`);
}

main().catch(console.error);