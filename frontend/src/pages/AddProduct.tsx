import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createProduct, previewProduct } from "../services/api";

const marketplaces = ["Amazon", "Flipkart", "Meesho", "Croma", "eBay", "Other"];

const KNOWN_PATTERNS = [
  { name: "Amazon", domains: ["amazon", "amzn"] },
  { name: "Flipkart", domains: ["flipkart", "fkrt"] },
  { name: "Meesho", domains: ["meesho"] },
  { name: "Croma", domains: ["croma"] },
  { name: "eBay", domains: ["ebay"] },
];

function detectMarketplaceFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const mp of KNOWN_PATTERNS) {
      if (mp.domains.some((d) => hostname.includes(d))) return mp.name;
    }
  } catch {}
  return "";
}

export default function AddProduct() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [marketplace, setMarketplace] = useState("");
  const [customMarketplace, setCustomMarketplace] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [externalId, setExternalId] = useState("");
  const [currency, setCurrency] = useState("INR");

  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [priceFetchFailed, setPriceFetchFailed] = useState(false);

  // Auto-detect marketplace & clear stale price/data when URL changes
  useEffect(() => {
    setPrice("");
    setExternalId("");
    setPriceFetchFailed(false);

    if (!url.trim()) return;

    const detected = detectMarketplaceFromUrl(url.trim());
    if (detected) {
      setMarketplace(detected);
    }
  }, [url]);

  const fetchDetails = async () => {
    if (!url.trim()) return;

    setFetching(true);
    setPriceFetchFailed(false);

    try {
      const data = await previewProduct(url.trim(), marketplace);

      setExternalId(data.externalId);
      setCurrency(data.currency || "INR");

      if (data.marketplace) setMarketplace(data.marketplace);
      if (data.price) {
        setPrice(String(data.price));
        setPriceFetchFailed(false);
      } else {
        setPriceFetchFailed(true);
      }
    } catch (error) {
      setPriceFetchFailed(true);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async () => {
    const currentPrice = Number(price);
    const targetPrice = Number(target);

    if (!url.trim()) return alert("Product URL is required.");
    if (!marketplace) return alert("Select a marketplace.");

    if (marketplace === "Other" && !customMarketplace.trim()) {
      return alert("Enter marketplace name.");
    }

    if (!currentPrice || currentPrice <= 0) {
      return alert("Enter the current price.");
    }

    if (!title.trim()) {
      return alert("Product name is required.");
    }

    if (!targetPrice || targetPrice <= 0) {
      return alert("Enter a target price.");
    }

    setSaving(true);

    try {
      await createProduct({
        title: title.trim(),
        targetPrice,
        listings: [
          {
            marketplace:
              marketplace === "Other"
                ? customMarketplace.trim()
                : marketplace,
            externalId,
            url: url.trim(),
            currentPrice,
            currency,
          },
        ],
      });

      navigate("/feed");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to add product."
      );
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-violet-500";

  const labelClass =
    "w-44 shrink-0 bg-slate-800 border border-slate-700 rounded-lg p-3 text-base font-bold text-slate-100 text-center";

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate("/feed")}
          className="text-slate-400 hover:text-white mb-6"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold">Add Product</h1>

        <p className="text-slate-400 mt-2 mb-8">
          Paste the product URL, fetch the price, then enter the product name
          and your target price.
        </p>

        <div className="space-y-4">

          {/* 1. Product URL */}
          <div className="flex items-center gap-4">
            <div className={labelClass}>Product URL *</div>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste product URL"
              className={fieldClass}
            />
          </div>

          <div className="ml-48 -mt-2 text-xs text-slate-500">
            Open the product in Chrome → click the address bar → Ctrl + L →
            Ctrl + C → paste here.
          </div>

          {/* 2. Fetch Details button */}
          <div className="ml-48">
            <button
              onClick={fetchDetails}
              disabled={!url.trim() || fetching}
              className="w-full border border-violet-600 text-violet-400 hover:bg-violet-600/10 rounded-lg p-3 disabled:opacity-50 transition"
            >
              {fetching ? "Fetching..." : "Fetch Details"}
            </button>
          </div>

          {fetching && (
            <p className="text-sm text-violet-400 ml-48">
              Fetching product details...
            </p>
          )}

          {/* 3. Current Price — autofilled from URL, editable */}
          <div className="flex items-center gap-4">
            <div className={labelClass}>Current price</div>
            <input
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Auto-filled — enter manually if needed"
              className={fieldClass}
            />
          </div>

          <p className="ml-48 -mt-2 text-xs text-slate-500">
            Auto-filled after "Fetch Details". Enter manually if scraping fails.
          </p>

          {/* Yellow warning message when price auto-fetch fails */}
          {priceFetchFailed && (
            <p className="ml-48 text-xs text-amber-400 font-medium">
              ⚠️ Could not fetch price automatically. Please enter current price manually.
            </p>
          )}

          {/* 4. Marketplace — autofilled from URL, editable */}
          <div className="flex items-center gap-4">
            <div className={labelClass}>Marketplace</div>
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              className={fieldClass}
            >
              <option value="">Select marketplace</option>
              {marketplaces.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {marketplace === "Other" && (
            <div className="flex items-center gap-4">
              <div className={labelClass}>Marketplace name</div>
              <input
                value={customMarketplace}
                onChange={(e) => setCustomMarketplace(e.target.value)}
                placeholder="Enter marketplace name"
                className={fieldClass}
              />
            </div>
          )}

          {/* 5. Product Name — manual, required */}
          <div className="flex items-center gap-4">
            <div className={labelClass}>Product name *</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter the product name"
              className={fieldClass}
            />
          </div>

          <p className="ml-48 -mt-2 text-xs text-slate-500">
            Enter the product name manually — shown on your dashboard.
          </p>

          {/* 6. Target Price — manual, required */}
          <div className="flex items-center gap-4">
            <div className={labelClass}>Target price *</div>
            <input
              type="number"
              min="1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Enter your target price"
              className={fieldClass}
            />
          </div>

          <p className="ml-48 -mt-2 text-xs text-slate-500">
            You'll be alerted when the price drops to or below this amount.
          </p>

          {/* 7. Start Tracking */}
          <div className="pt-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full bg-violet-600 hover:bg-violet-500 rounded-lg p-3 font-semibold disabled:opacity-50 transition"
            >
              {saving ? "Starting..." : "Start Tracking"}
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}