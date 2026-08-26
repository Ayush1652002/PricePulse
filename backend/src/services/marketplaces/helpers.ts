import * as cheerio from "cheerio";

export function isAmazonShortUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?amzn\.(in|to|com|eu)\/d\//i.test(url);
}

export function isShortUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(amzn\.(in|to|com|eu)|dl\.flipkart\.com|fkrt\.it)\//i.test(url);
}

export async function resolveShortUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    return response.url || url;
  } catch {
    return url;
  }
}

export function getExternalId(url: string, marketplace: string) {
  const parsed = new URL(url);

  if (marketplace === "Amazon") {
    const match = parsed.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (match) return match[1];
  }

  if (marketplace === "Flipkart") {
    const pid = parsed.searchParams.get("pid");
    if (pid) return pid;
    const match = parsed.pathname.match(/\/p\/(itm[a-zA-Z0-9]+)/i);
    if (match) return match[1];
  }

  if (marketplace === "eBay") {
    const match = parsed.pathname.match(/\/(?:itm|p)\/(\d+)/i);
    if (match) return match[1];
  }

  return `url-${Buffer.from(parsed.toString()).toString("base64url").slice(0, 40)}`;
}

export function cleanAmazonUrl(url: string) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return match ? `${parsed.origin}/dp/${match[1]}` : url;
}

export function parsePrice($: cheerio.CheerioAPI): number | null {
  const $clean = cheerio.load($.html());
  $clean(".a-text-price, .a-text-strike, .basisPrice, del, s, .strike-price, .strikethrough, [data-a-color='secondary']").remove();

  // 1. Amazon Target Selling Price Containers (HIGHEST PRIORITY)
  const amazonContainers = [
    ".priceToPay",
    ".apex_pricetopay_value",
    ".reinventPricePriceToPayMargin",
    "#corePriceDisplay_desktop_feature_div",
    "#corePrice_feature_div",
    "#priceblock_dealprice",
    "#priceblock_ourprice",
    "#price",
  ];

  for (const selector of amazonContainers) {
    const container = $clean(selector).first();
    if (!container.length) continue;

    const wholeText = container.find(".a-price-whole").first().text().trim();
    if (wholeText) {
      const match = wholeText.replace(/,/g, "").match(/(\d+)/);
      if (match) {
        const val = Number(match[1]);
        if (val >= 10 && val < 10_000_000) return val;
      }
    }

    const offText = container.find(".a-offscreen").first().text().trim();
    if (offText) {
      const match = offText.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
      if (match) {
        const val = Number(match[1]);
        if (val >= 10 && val < 10_000_000) return val;
      }
    }
  }

  // 2. eBay Specific Price Selectors
  const ebaySelectors = [
    "[data-testid='x-price-primary'] .ux-textspans",
    "[data-testid='x-price-primary']",
    ".x-price-primary .ux-textspans",
    ".x-price-primary",
    "#prcIsum",
    "#mm-saleDscrPrc",
    ".x-bin-price__content",
  ];

  for (const selector of ebaySelectors) {
    const element = $clean(selector).first();
    if (!element.length) continue;

    const text = element.attr("content") ?? element.attr("value") ?? element.text();
    const match = text.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);

    if (match) {
      const val = Number(match[1]);
      if (val >= 1 && val < 10_000_000) return val;
    }
  }

  // 3. Strict JSON-LD — typed Product/Offer objects
  const jsonLdScripts = $clean('script[type="application/ld+json"]');
  for (let i = 0; i < jsonLdScripts.length; i++) {
    try {
      const content = $clean(jsonLdScripts[i]).html();
      if (!content) continue;

      const data = JSON.parse(content);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const type = item?.["@type"];
        if (type !== "Product" && type !== "Offer" && type !== "AggregateOffer") continue;

        const offers = item?.offers;
        const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
        for (const offer of offerList) {
          const rawPrice = offer?.price ?? offer?.lowPrice;
          if (rawPrice !== undefined && rawPrice !== null) {
            const val = Number(String(rawPrice).replace(/[^0-9.]/g, ""));
            if (val >= 1) return val;
          }
        }

        if (item?.price !== undefined) {
          const val = Number(String(item.price).replace(/[^0-9.]/g, ""));
          if (val >= 1) return val;
        }
      }
    } catch {}
  }

  // 4. Flipkart & Croma Selectors
  const otherSelectors = [
    // Flipkart
    ".Nx9bqj._4b5DiR",
    ".Nx9bqj",
    "._30jeq3._16JgWd",
    "._30jeq3",

    // Croma
    ".cp-price",
    "#pdp-price",
    ".pdp-price",
    "[class*='pdp-price']",
    ".pdp-price .amount",
    ".new-price .amount",
    ".main-price",
    ".amount",

    // Universal fallbacks
    '[itemprop="price"]',
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[name="twitter:data1"]',
    ".a-price-whole",
    ".a-price .a-offscreen",
  ];

  for (const selector of otherSelectors) {
    const elements = $clean(selector).toArray();
    for (const el of elements) {
      const text = $clean(el).attr("content") ?? $clean(el).attr("value") ?? $clean(el).text();
      const match = text.replace(/,/g, "").match(/(\$|₹|£|EUR)?\s*(\d+(?:\.\d{1,2})?)/);

      if (match && match[2]) {
        const val = Number(match[2]);
        if (val >= 1 && val < 10_000_000) return val;
      }
    }
  }

  return null;
}

export function parseTitle($: cheerio.CheerioAPI): string | null {
  const ebayTitle = $("[data-testid='x-item-title'] .ux-textspans, .x-item-title").first().text().trim();
  if (ebayTitle) return ebayTitle;

  const metaTitle =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="title"]').attr("content") ||
    $("title").text().trim() ||
    $("#productTitle").text().trim() ||
    $("h1").first().text().trim();

  if (metaTitle && !metaTitle.toLowerCase().includes("access denied") && !metaTitle.toLowerCase().includes("error page")) {
    return metaTitle.replace(/\s*\|?\s*eBay$/i, "").trim();
  }

  const jsonLdScripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < jsonLdScripts.length; i++) {
    try {
      const content = $(jsonLdScripts[i]).html();
      if (!content) continue;
      const data = JSON.parse(content);
      const item = Array.isArray(data) ? data[0] : data;
      if (item?.["@type"] === "Product" && item?.name) return item.name;
    } catch {}
  }

  return null;
}

export async function fetchHtml(url: string) {
  const resolvedUrl = isShortUrl(url) ? await resolveShortUrl(url) : url;

  // 1. Try Direct Fetch with realistic Browser Headers first (super fast, no rate-limits)
  try {
    const directRes = await fetch(resolvedUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
    });

    if (directRes.ok) {
      const html = await directRes.text();
      if (html && html.length > 1000 && !html.toLowerCase().includes("validatecaptcha")) {
        return html;
      }
    }
  } catch {}

  // 2. Primary Proxy Fallback (Jina AI)
  try {
    const response = await fetch(`https://r.jina.ai/${resolvedUrl}`, {
      headers: {
        "X-Return-Format": "html",
        "Accept-Language": "en-IN,en;q=0.9",
      },
    });

    if (response.ok) {
      const html = await response.text();
      if (html && html.length > 500) {
        return html;
      }
    }
  } catch {}

  // 3. Universal Proxy Fallback (CorsProxy / AllOrigins)
  try {
    const corsRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(resolvedUrl)}`);
    if (corsRes.ok) {
      const html = await corsRes.text();
      if (html && html.length > 1000) return html;
    }
  } catch {}

  throw new Error("Unable to fetch product page from marketplace.");
}