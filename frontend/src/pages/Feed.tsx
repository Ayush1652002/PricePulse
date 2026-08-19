import { useEffect, useRef, useState } from "react";
import {
  checkProductPrice,
  deleteProduct,
  getNotifications,
  getPriceHistory,
  getProfile,
  getProducts,
  logout,
  resetAlert,
  subscribeToNotifications,
  updateProduct,
  updateProductPrice,
} from "../services/api";
import { useNavigate } from "react-router-dom";
import { registerPushNotifications } from "../services/push.service";

type UserProfile = {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

type HistoryItem = {
  id: string;
  price: string;
  currency: string;
  checkedAt: string;
  listing: { marketplace: { name: string } };
};

type Tracking = any;

function ProductCard({
  tracking,
  busy,
  history,
  historyOpen,
  onEdit,
  onStop,
  onResume,
  onDelete,
  onCheck,
  onHistory,
  onResetAlert,
}: {
  tracking: Tracking;
  busy: boolean;
  history?: HistoryItem[];
  historyOpen: boolean;
  onEdit: () => void;
  onStop: () => void;
  onResume: () => void;
  onDelete: () => void;
  onCheck: () => void;
  onHistory: () => void;
  onResetAlert: () => void;
}) {
  const product = tracking.product;
  const below = tracking.alert?.isBelowTarget;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex justify-between items-start mb-5 gap-4">
        <div className="min-w-0">
          <h3 className="text-2xl font-semibold truncate">{product.title}</h3>
          <p className="text-slate-400 mt-2">
            Target price:{" "}
            <span className="text-violet-400 font-semibold">
              ₹{tracking.targetPrice}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={
              below
                ? "bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-sm"
                : "bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-sm"
            }
          >
            {below ? "TARGET REACHED" : tracking.status}
          </span>

          <button
            onClick={onEdit}
            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-violet-500 text-sm"
          >
            Edit
          </button>

          {tracking.status === "STOPPED" ? (
            <button
              onClick={onResume}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-emerald-900/70 hover:border-emerald-500 text-emerald-400 text-sm disabled:opacity-50"
            >
              {busy ? "..." : "Resume"}
            </button>
          ) : (
            <button
              onClick={onStop}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-amber-900/70 hover:border-amber-500 text-amber-400 text-sm disabled:opacity-50"
            >
              {busy ? "..." : "Stop"}
            </button>
          )}

          <button
            onClick={onDelete}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg border border-red-900/70 hover:border-red-500 text-red-400 text-sm disabled:opacity-50"
          >
            {busy ? "..." : "Delete"}
          </button>
        </div>
      </div>

      {below && (
        <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-emerald-300">
              Price is at or below your target 🎉
            </p>
            <p className="text-sm text-slate-400 mt-1">
              You can reset this alert after reviewing the deal.
            </p>
          </div>

          <button
            onClick={onResetAlert}
            disabled={busy}
            className="text-sm border border-slate-700 rounded-lg px-3 py-2 hover:border-violet-500 disabled:opacity-50"
          >
            Reset alert
          </button>
        </div>
      )}

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
              {listing.currency} {listing.currentPrice}
            </p>

            {listing.previousPrice !== null && (
              <p className="text-xs text-slate-500 mt-1">
                Previous: {listing.currency} {listing.previousPrice}
              </p>
            )}

            <p className="text-slate-500 text-sm mt-2">View product →</p>
          </a>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-slate-800">
        <button
          onClick={onCheck}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm disabled:opacity-50"
        >
          {busy ? "Checking..." : "Check price now"}
        </button>

        <button
          onClick={onHistory}
          className="px-4 py-2 rounded-lg border border-slate-700 hover:border-violet-500 text-sm"
        >
          {historyOpen ? "Hide price history" : "View price history"}
        </button>
      </div>

      {historyOpen && (
        <div className="mt-4 rounded-xl bg-slate-950 border border-slate-800 p-4">
          {history?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="text-left py-2">Marketplace</th>
                    <th className="text-left py-2">Price</th>
                    <th className="text-left py-2">Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history]
                    .reverse()
                    .slice(0, 10)
                    .map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-900 last:border-0"
                      >
                        <td className="py-2.5">
                          {item.listing.marketplace.name}
                        </td>
                        <td className="py-2.5 font-semibold">
                          {item.currency} {item.price}
                        </td>
                        <td className="py-2.5 text-slate-500">
                          {new Date(item.checkedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No price history recorded yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationsPanel({
  open,
  notifications,
}: {
  open: boolean;
  notifications: any[];
}) {
  if (!open) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-lg font-semibold mb-4">Notifications</h3>

        {notifications.length === 0 ? (
          <p className="text-slate-500 text-sm">No notifications yet.</p>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="border border-slate-800 rounded-xl p-4"
              >
                <p className="font-medium">
                  Price Alert:{" "}
                  {notification.alert.trackedProduct.product.title}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Your target price was reached.
                </p>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-slate-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </span>
                  <span className="text-xs text-emerald-400">
                    {notification.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditProductModal({
  product,
  title,
  target,
  status,
  price,
  onTitleChange,
  onTargetChange,
  onStatusChange,
  onPriceChange,
  onClose,
  onSave,
  saving,
}: {
  product: Tracking | null;
  title: string;
  target: string;
  status: "ACTIVE" | "PAUSED" | "STOPPED";
  price: string;
  onTitleChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onStatusChange: (value: "ACTIVE" | "PAUSED" | "STOPPED") => void;
  onPriceChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-4 grid place-items-center">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold">Edit product</h3>
            <p className="text-sm text-slate-500 mt-1">
              Update tracking details.
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400">Product name</label>
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg p-3"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400">Target price</label>
            <input
              type="number"
              min="0.01"
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg p-3"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400">
              Current price (manual override)
            </label>
            <input
              type="number"
              min="0.01"
              value={price}
              onChange={(e) => onPriceChange(e.target.value)}
              placeholder="Override the scraped price if it's wrong"
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg p-3"
            />
            <p className="text-xs text-slate-500 mt-1">
              Use this if automatic price checks fetch the wrong price.
              Leave unchanged to keep the current value.
            </p>
          </div>

          <div>
            <label className="text-sm text-slate-400">Tracking status</label>
            <select
              value={status}
              onChange={(e) =>
                onStatusChange(
                  e.target.value as "ACTIVE" | "PAUSED" | "STOPPED"
                )
              }
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg p-3"
            >
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="STOPPED">Stopped</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!title.trim() || Number(target) <= 0 || saving}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Feed() {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<Tracking[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [actionId, setActionId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryItem[]>>({});
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});

  const [editProduct, setEditProduct] = useState<Tracking | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] =
    useState<"ACTIVE" | "PAUSED" | "STOPPED">("ACTIVE");

  const loadProducts = async () => {
    const data = await getProducts();
    setProducts(data.products);
  };

  useEffect(() => {
    Promise.all([getProducts(), getProfile()])
      .then(([productData, profileData]) => {
        setProducts(productData.products);
        setProfile(profileData.user);
      })
      .catch((error) => {
        console.error(error);
        navigate("/");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/");
    }
  };

  const handleNotifications = async () => {
    setNotificationLoading(true);

    try {
      const subscription = await registerPushNotifications();
      await subscribeToNotifications(subscription);
      alert("Notifications enabled! 🔔");
    } catch (error) {
      console.error(error);
      alert("Push notifications are unavailable on this browser right now.");
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleNotificationList = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications);
      setNotificationsOpen((open) => !open);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to load notifications."
      );
    }
  };

    const openEdit = (tracking: Tracking) => {
    setEditProduct(tracking);
    setEditTitle(tracking.product.title);
    setEditTarget(String(tracking.targetPrice));
    setEditPrice(String(tracking.product.listings[0]?.currentPrice ?? ""));
    setEditStatus(tracking.status);
  };

  const saveEdit = async () => {
    if (!editProduct) return;

    setActionId(editProduct.id);

    try {
      await updateProduct(editProduct.product.id, {
        title: editTitle.trim(),
        targetPrice: Number(editTarget),
        status: editStatus,
      });

      const listing = editProduct.product.listings[0];
      const newPrice = Number(editPrice);

      if (
        listing &&
        newPrice > 0 &&
        newPrice !== Number(listing.currentPrice)
      ) {
        await updateProductPrice(
          editProduct.product.id,
          newPrice,
          listing.currency
        );
      }

      await loadProducts();
      setEditProduct(null);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to update product."
      );
    } finally {
      setActionId(null);
    }
  };

  const handleStop = async (tracking: Tracking) => {
    if (!window.confirm(`Stop tracking "${tracking.product.title}"?`)) return;

    setActionId(tracking.id);

    try {
      await updateProduct(tracking.product.id, {
        status: "STOPPED",
      });

      await loadProducts();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to stop tracking."
      );
    } finally {
      setActionId(null);
    }
  };

  const handleResume = async (tracking: Tracking) => {
    setActionId(tracking.id);

    try {
      await updateProduct(tracking.product.id, {
        status: "ACTIVE",
      });

      await loadProducts();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to resume tracking."
      );
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (tracking: Tracking) => {
    if (
      !window.confirm(
        `Delete "${tracking.product.title}" permanently? This cannot be undone.`
      )
    ) {
      return;
    }

    setActionId(tracking.id);

    try {
      await deleteProduct(tracking.product.id);
      await loadProducts();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to delete product."
      );
    } finally {
      setActionId(null);
    }
  };

  const handleHistory = async (id: string) => {
    const open = !historyOpen[id];

    setHistoryOpen((current) => ({
      ...current,
      [id]: open,
    }));

    if (!open || history[id]) return;

    try {
      const data = await getPriceHistory(id);

      setHistory((current) => ({
        ...current,
        [id]: data.history,
      }));
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to load price history."
      );

      setHistoryOpen((current) => ({
        ...current,
        [id]: false,
      }));
    }
  };

  const handleCheck = async (tracking: Tracking) => {
    setActionId(tracking.id);

    try {
      await checkProductPrice(tracking.product.id);
      await loadProducts();

      if (history[tracking.product.id]) {
        const data = await getPriceHistory(tracking.product.id);

        setHistory((current) => ({
          ...current,
          [tracking.product.id]: data.history,
        }));
      }

      alert("Price check completed.");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Price check failed."
      );
    } finally {
      setActionId(null);
    }
  };

  const handleResetAlert = async (tracking: Tracking) => {
    setActionId(tracking.id);

    try {
      await resetAlert(tracking.product.id);
      await loadProducts();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to reset alert."
      );
    } finally {
      setActionId(null);
    }
  };

  const initials = (profile?.displayName || profile?.email || "U")
    .split(" ")
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 md:px-8 py-4 flex justify-between items-center sticky top-0 z-20 bg-slate-950/95 backdrop-blur">
        <button
          onClick={() => navigate("/feed")}
          className="text-2xl font-bold text-violet-500"
        >
          PricePulse
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleNotificationList}
            className="hidden sm:block bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg text-sm font-medium"
          >
            🔔 Notifications
          </button>

          <button
            onClick={handleNotifications}
            disabled={notificationLoading}
            className="hidden sm:block bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium"
          >
            {notificationLoading ? "Enabling..." : "Enable alerts"}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-900 transition"
            >
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="Profile"
                  className="w-9 h-9 rounded-full object-cover border border-slate-700"
                />
              ) : (
                <span className="w-9 h-9 rounded-full bg-violet-600 grid place-items-center text-sm font-bold">
                  {initials}
                </span>
              )}

              <span className="hidden md:block text-left max-w-36">
                <span className="block text-sm font-semibold truncate">
                  {profile?.displayName || "Account"}
                </span>
                <span className="block text-xs text-slate-500 truncate">
                  {profile?.email}
                </span>
              </span>

              <span className="text-slate-500">⌄</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3">
                <div className="flex items-center gap-3 p-3 border-b border-slate-800">
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Profile"
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-11 h-11 rounded-full bg-violet-600 grid place-items-center font-bold">
                      {initials}
                    </span>
                  )}

                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {profile?.displayName || "PricePulse User"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {profile?.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleNotifications}
                  disabled={notificationLoading}
                  className="sm:hidden w-full text-left px-3 py-2.5 mt-2 rounded-lg hover:bg-slate-800 text-sm"
                >
                  🔔{" "}
                  {notificationLoading
                    ? "Enabling..."
                    : "Enable notifications"}
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2.5 mt-1 rounded-lg hover:bg-slate-800 text-red-400 text-sm"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <NotificationsPanel
        open={notificationsOpen}
        notifications={notifications}
      />

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex justify-between items-start gap-6 mb-8">
          <div>
            <p className="text-violet-400 text-sm font-semibold mb-2">
              PRICE TRACKER
            </p>
            <h2 className="text-3xl font-bold">Your Products</h2>
            <p className="text-slate-400 mt-2">
              Track prices and get alerted when your target price is reached.
            </p>
          </div>

          <button
            onClick={() => navigate("/add-product")}
            className="shrink-0 bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg font-medium"
          >
            + Add Product
          </button>
        </div>

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-slate-400">
            Loading your products...
          </div>
        ) : products.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-4">🛒</div>
            <h3 className="text-xl font-semibold">Nothing tracked yet</h3>
            <p className="text-slate-400 mt-2 mb-6">
              Add a product link and PricePulse will track its price for you.
            </p>
            <button
              onClick={() => navigate("/add-product")}
              className="bg-violet-600 hover:bg-violet-500 px-5 py-2.5 rounded-lg font-medium"
            >
              Track your first product
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {products.map((tracking) => (
              <ProductCard
                key={tracking.id}
                tracking={tracking}
                busy={actionId === tracking.id}
                history={history[tracking.product.id]}
                historyOpen={Boolean(historyOpen[tracking.product.id])}
                onEdit={() => openEdit(tracking)}
                onStop={() => handleStop(tracking)}
                onResume={() => handleResume(tracking)}
                onDelete={() => handleDelete(tracking)}
                onCheck={() => handleCheck(tracking)}
                onHistory={() => handleHistory(tracking.product.id)}
                onResetAlert={() => handleResetAlert(tracking)}
              />
            ))}
          </div>
        )}
      </main>

            <EditProductModal
        product={editProduct}
        title={editTitle}
        target={editTarget}
        status={editStatus}
        price={editPrice}
        onTitleChange={setEditTitle}
        onTargetChange={setEditTarget}
        onStatusChange={setEditStatus}
        onPriceChange={setEditPrice}
        onClose={() => setEditProduct(null)}
        onSave={saveEdit}
        saving={actionId === editProduct?.id}
      />
    </div>
  );
}