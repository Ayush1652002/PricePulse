import * as cheerio from "cheerio";

export async function fetchProductPrice(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Marketplace returned ${response.status}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const priceSelectors = [
    '[itemprop="price"]',
    ".a-price .a-offscreen",
    ".price",
    ".product-price",
    '[class*="price"]',
  ];

  for (const selector of priceSelectors) {
    const element = $(selector).first();

    if (!element.length) continue;

    const text =
      element.attr("content") ||
      element.text();

    const match = text.replace(/,/g, "").match(
      /(\d+(?:\.\d{1,2})?)/
    );

    if (match) {
      return Number(match[1]);
    }
  }

  throw new Error("Price could not be found.");
}