import { useEffect, useState } from "react";
import { getProducts, logout } from "../services/api";
import { useNavigate } from "react-router-dom";
import { registerPushNotifications } from "../services/push.service";

export default function Feed() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts()
      .then((data) => setProducts(data.products))
      .catch((error) => {
        console.error(error);
        navigate("/");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleNotifications = async () => {
  try {
    const subscription = await registerPushNotifications();

    const response = await fetch(
      "http://localhost:3000/api/notifications/subscribe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(subscription),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to enable notifications.");
    }

    alert("Notifications enabled! 🔔");
  } catch (error) {
    console.error(error);
    alert("Failed to enable notifications.");
  }
};

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-8 py-5 flex justify-between items-center">
  <h1 className="text-2xl font-bold text-violet-500">
    PricePulse
  </h1>

  <div className="flex items-center gap-3">
    <button
      onClick={handleNotifications}
      className="bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg"
    >
      🔔 Enable Notifications
    </button>

    <button
      onClick={handleLogout}
      className="text-slate-400 hover:text-white"
    >
      Logout
    </button>
  </div>
</header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex justify-between items-start">
  <div>
    <h2 className="text-3xl font-bold">
      Your Products
    </h2>

    <p className="text-slate-400 mt-2">
      Track prices across multiple marketplaces.
    </p>
  </div>

  <button
    onClick={() => navigate("/add-product")}
    className="bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg"
  >
    + Add Product
  </button>
</div>

        {loading ? (
          <p className="text-slate-400">
            Loading products...
          </p>
        ) : products.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
            <p className="text-slate-400">
              No products tracked yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {products.map((tracking) => {
              const product = tracking.product;

              return (
                <div
                  key={tracking.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-semibold">
                        {product.title}
                      </h3>

                      <p className="text-slate-400 mt-2">
                        Target price:{" "}
                        <span className="text-violet-400 font-semibold">
                          ₹{tracking.targetPrice}
                        </span>
                      </p>
                    </div>

                    <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-sm">
                      {tracking.status}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    {product.listings.map((listing: any) => (
                      <a
                        key={listing.id}
                        href={listing.url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-violet-500 transition"
                      >
                        <p className="text-violet-400 font-semibold">
                          {listing.marketplace.name}
                        </p>

                        <p className="text-2xl font-bold mt-3">
                          {listing.currency}{" "}
                          {listing.currentPrice}
                        </p>

                        <p className="text-slate-500 text-sm mt-2">
                          View product →
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}