import { useState } from "react";
import { createProduct } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function AddProduct() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [targetPrice, setTargetPrice] = useState("");

  const [listings, setListings] = useState([
    {
      marketplace: "",
      externalId: "",
      url: "",
      currentPrice: "",
    },
  ]);

  const addListing = () => {
    setListings([
      ...listings,
      {
        marketplace: "",
        externalId: "",
        url: "",
        currentPrice: "",
      },
    ]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createProduct({
        title,
        targetPrice: Number(targetPrice),

        listings: listings.map((item) => ({
          ...item,
          currentPrice: Number(item.currentPrice),
          currency: "INR",
        })),
      });

      navigate("/feed");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to add product."
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          Add Product
        </h1>

        <form onSubmit={submit} className="space-y-6">
          <input
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3"
            placeholder="Product name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <input
            type="number"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3"
            placeholder="Target price"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            required
          />

          {listings.map((listing, index) => (
            <div
              key={index}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
            >
              <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3"
                placeholder="Marketplace (Amazon)"
                value={listing.marketplace}
                onChange={(e) => {
                  const copy = [...listings];
                  copy[index].marketplace = e.target.value;
                  setListings(copy);
                }}
                required
              />

              <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3"
                placeholder="Product URL"
                value={listing.url}
                onChange={(e) => {
                  const copy = [...listings];
                  copy[index].url = e.target.value;
                  setListings(copy);
                }}
                required
              />

              <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3"
                placeholder="Current price"
                type="number"
                value={listing.currentPrice}
                onChange={(e) => {
                  const copy = [...listings];
                  copy[index].currentPrice = e.target.value;
                  setListings(copy);
                }}
                required
              />

              <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3"
                placeholder="External ID"
                value={listing.externalId}
                onChange={(e) => {
                  const copy = [...listings];
                  copy[index].externalId = e.target.value;
                  setListings(copy);
                }}
                required
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addListing}
            className="border border-violet-500 text-violet-400 px-4 py-2 rounded-lg"
          >
            + Add marketplace
          </button>

          <button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-500 py-3 rounded-lg font-medium"
          >
            Start Tracking
          </button>
        </form>
      </div>
    </div>
  );
}