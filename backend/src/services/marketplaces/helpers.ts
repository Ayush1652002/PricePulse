import * as cheerio from "cheerio";

export function getExternalId(url: string, marketplace: string) {
  const parsed = new URL(url);

  if (marketplace === "Amazon") {
    const match = parsed.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (match) return match[1];
  }

  if (marketplace === "Flipkart") {
    return parsed.searchParams.get("pid") || "";
  }

  if (marketplace === "eBay") {
    const match = parsed.pathname.match(/\/itm\/(\d+)/i);
    if (match) return match[1];
  }

  return `url-${Buffer.from(parsed.toString()).toString("base64url").slice(0, 40)}`;
}

export function cleanAmazonUrl(url: string) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return match ? `${parsed.origin}/dp/${match[1]}` : url;
}

export function parsePrice($: cheerio.CheerioAPI) {
  const selectors = [
    '[itemprop="price"]',
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    "#priceblock_ourprice",
    "#priceblock_dealprice",
    ".a-price .a-offscreen",
    "#corePriceDisplay_desktop_feature_div .a-offscreen",
    ".priceToPay .a-offscreen",
    ".a-price-whole",
    ".price",
    ".product-price",
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (!element.length) continue;

    const text = element.attr("content") || element.attr("value") || element.text();
    const match = text.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);

    if (match && Number(match[1]) > 0) return Number(match[1]);
  }

  return null;
}

export function parseTitle($: cheerio.CheerioAPI) {
  return (
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="title"]').attr("content") ||
    $("#productTitle").text().trim() ||
    null
  );
}

export async function fetchHtml(url: string) {
  // Fetch through Jina's free reader proxy instead of hitting the
  // marketplace directly — it renders the page server-side and often
  // gets past basic bot walls that block a plain fetch(). Free, no API key.
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      "X-Return-Format": "html",
      "Accept-Language": "en-IN,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Marketplace returned ${response.status}`);
  }

  return response.text();
}