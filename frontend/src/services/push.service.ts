function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    Array.from(rawData).map((char) => char.charCodeAt(0))
  );
}

export async function registerPushNotifications() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported.");
  }

  if (!("PushManager" in window)) {
    throw new Error("Push notifications are not supported.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");

  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission denied.");
  }

  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error("VAPID public key is missing.");
  }

  const applicationServerKey =
    urlBase64ToUint8Array(publicKey);

  if (applicationServerKey.length !== 65) {
    throw new Error("Invalid VAPID public key.");
  }

  const existingSubscription =
    await registration.pushManager.getSubscription();

  if (existingSubscription) {
    return existingSubscription;
  }

  return await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}