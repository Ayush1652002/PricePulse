import { describe, it, expect, vi, afterEach } from "vitest";
import * as cheerio from "cheerio";
import {
  parsePrice,
  getExternalId,
  cleanAmazonUrl,
  isShortUrl,
  resolveShortUrl,
} from "../src/services/marketplaces/helpers.js";
import { escapeHtml, safeHttpUrl, formatPrice } from "../src/services/alert.service.js";

const load = (html: string) => cheerio.load(html);

describe("parsePrice", () => {
  it("reads the Amazon selling price", () => {
    const $ = load(`<div id="corePrice_feature_div"><span class="a-price"><span class="a-price-whole">1,299.</span></span></div>`);
    expect(parsePrice($)).toBe(1299);
  });

  it("ignores the crossed-out (strikethrough) price", () => {
    const $ = load(`
      <div id="corePrice_feature_div">
        <span class="a-text-price"><span class="a-offscreen">₹1,999</span></span>
        <span class="a-price"><span class="a-offscreen">₹1,499.00</span></span>
      </div>`);
    expect(parsePrice($)).toBe(1499);
  });

  it("reads price from JSON-LD when the shop-specific selectors are missing", () => {
    const $ = load(`<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"2499"}}</script>`);
    expect(parsePrice($)).toBe(2499);
  });

  it("returns null when the page has no price", () => {
    expect(parsePrice(load("<html><body><p>Hello</p></body></html>"))).toBeNull();
  });
});

describe("URL helpers", () => {
  it("getExternalId finds the Amazon ASIN", () => {
    expect(getExternalId("https://www.amazon.in/Some-Name/dp/B0ABCDE123/ref=x?th=1", "Amazon")).toBe("B0ABCDE123");
  });

  it("getExternalId finds the Flipkart pid", () => {
    expect(getExternalId("https://www.flipkart.com/x/p/itm123abc?pid=MOBXYZ", "Flipkart")).toBe("MOBXYZ");
  });

  it("getExternalId finds the eBay item number", () => {
    expect(getExternalId("https://www.ebay.com/itm/123456789012", "eBay")).toBe("123456789012");
  });

  it("cleanAmazonUrl removes tracking text from the link", () => {
    expect(cleanAmazonUrl("https://www.amazon.in/Name/dp/B0ABCDE123/ref=sr_1_1?crid=1")).toBe("https://www.amazon.in/dp/B0ABCDE123");
  });

  it("isShortUrl detects short links", () => {
    expect(isShortUrl("https://amzn.in/d/abc")).toBe(true);
    expect(isShortUrl("https://www.amazon.in/dp/B0ABCDE123")).toBe(false);
  });
});

describe("resolveShortUrl redirect safety", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a redirect to a supported shop", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ url: "https://www.amazon.in/dp/B0ABCDE123" })));
    await expect(resolveShortUrl("https://amzn.in/d/abc")).resolves.toBe("https://www.amazon.in/dp/B0ABCDE123");
  });

  it("rejects a redirect to any other website", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ url: "https://evil.example.com/steal" })));
    await expect(resolveShortUrl("https://amzn.in/d/abc")).rejects.toThrow(/unsupported website/i);
  });

  it("sends a timeout signal with the request", async () => {
    const mock = vi.fn(async () => ({ url: "https://www.amazon.in/dp/B0ABCDE123" }));
    vi.stubGlobal("fetch", mock);
    await resolveShortUrl("https://amzn.in/d/abc");
    const init = (mock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeDefined();
  });
});

describe("email helpers", () => {
  it("escapeHtml turns HTML into plain text", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("safeHttpUrl only allows web links", () => {
    expect(safeHttpUrl("https://www.amazon.in/dp/B0ABCDE123")).toContain("https://www.amazon.in/");
    expect(safeHttpUrl("javascript:alert(1)")).toBe("#");
    expect(safeHttpUrl("not a url")).toBe("#");
  });

  it("formatPrice uses the right symbol", () => {
    expect(formatPrice("INR", 999)).toBe("₹999");
    expect(formatPrice(null, 999)).toBe("₹999");
    expect(formatPrice("USD", 10)).toBe("$10");
  });
});
