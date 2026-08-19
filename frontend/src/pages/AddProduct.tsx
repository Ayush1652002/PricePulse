import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProduct, previewProduct } from "../services/api";

const marketplaces = ["Amazon", "Flipkart", "Meesho", "Croma", "eBay", "Other"];

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

  const fetchDetails = async () => {
    if (!url.trim()) return;

    setFetching(true);

    try {
      const data = await previewProduct(url.trim(), marketplace);

      setExternalId(data.externalId);
      setCurrency(data.currency || "INR");

      if (data.marketplace) setMarketplace(data.marketplace);
      if (data.title && !title) setTitle(data.title);

      if (data.price) {
        setPrice(String(data.price));

        if (!target) {
          setTarget(String(Math.max(1, data.price - 50)));
        }
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not fetch product details."
      );
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async () => {
    const currentPrice = Number(price);
    const targetPrice = target
      ? Number(target)
      : Math.max(1, currentPrice - 50);

    if (!url.trim()) return alert("Product URL is required.");
    if (!marketplace) return alert("Select a marketplace.");

    if (marketplace === "Other" && !customMarketplace.trim()) {
      return alert("Enter marketplace name.");
    }

    if (!currentPrice || currentPrice <= 0) {
      return alert("Enter the current price.");
    }

    setSaving(true);

    try {
      await createProduct({
        title: title.trim() || `${marketplace} Product`,
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
          Paste the product page URL and we will fetch its details.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-44 shrink-0 bg-slate-800 border border-slate-700 rounded-lg p-3 text-base font-bold text-slate-100 text-center">
              Product URL *
            </div>

            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={fetchDetails}
              placeholder="Paste product URL"
              className={fieldClass}
            />
          </div>

          <div className="ml-48 -mt-2 text-xs text-slate-500">
            Open the product in Chrome → click the address bar → press Ctrl + L,
            then Ctrl + C and paste the URL here.
          </div>

          {fetching && (
            <p className="text-sm text-violet-400 ml-48">
              Fetching product details...
            </p>
          )}

          <div className="flex items-center gap-4">
            <div className="w-44 shrink-0 bg-slate-800 border border-slate-700 rounded-lg p-3 text-base font-bold text-slate-100 text-center">
              Product name
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional — auto-filled when possible"
              className={fieldClass}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="w-44 shrink-0 bg-slate-800 border border-slate-700 rounded-lg p-3 text-base font-bold text-slate-100 text-center">
              Target price
            </div>

            <input
              type="number"
              min="1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Optional — defaults to ₹50 below current price"
              className={fieldClass}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="w-44 shrink-0 bg-slate-800 border border-slate-700 rounded-lg p-3 text-base font-bold text-slate-100 text-center">
              Marketplace
            </div>

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
              <div className="w-44 shrink-0 bg-slate-800 border border-slate-700 rounded-lg p-3 text-base font-bold text-slate-100 text-center">
                Marketplace name
              </div>

              <input
                value={customMarketplace}
                onChange={(e) => setCustomMarketplace(e.target.value)}
                placeholder="Enter marketplace name"
                className={fieldClass}
              />
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="w-44 shrink-0 bg-slate-800 border border-slate-700 rounded-lg p-3 text-base font-bold text-slate-100 text-center">
              Current price
            </div>

            <input
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Auto-filled — manual fallback"
              className={fieldClass}
            />
          </div>

          <p className="ml-48 text-xs text-slate-500">
            If automatic price fetching fails, enter the current price
            manually.
          </p>

          <div className="flex gap-4 pt-3">
            <button
              onClick={fetchDetails}
              disabled={!url.trim() || fetching}
              className="flex-1 border border-violet-600 text-violet-400 hover:bg-violet-600/10 rounded-lg p-3 disabled:opacity-50"
            >
              {fetching ? "Fetching..." : "Fetch details"}
            </button>

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 bg-violet-600 hover:bg-violet-500 rounded-lg p-3 font-semibold disabled:opacity-50"
            >
              {saving ? "Starting..." : "Start Tracking"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
