import webpush from "web-push";
import prisma from "../config/prisma.js";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:alerts@pricepulse.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn("[WebPush] VAPID keys are missing from environment variables.");
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn("[WebPush] Push skipped: VAPID keys not configured.");
    return false;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  console.log(`[WebPush] User: ${userId}`);
  console.log(`[WebPush] Push subscriptions found: ${subscriptions.length}`);

  if (subscriptions.length === 0) {
    console.log(`[WebPush] Summary — found: 0, sent: 0, failed: 0`);
    return false;
  }

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({
          title,
          body,
          url: "/feed",
        })
      );

      sent += 1;
      console.log(`[WebPush] Push sent to subscription: ${subscription.id}`);
    } catch (error: any) {
      failed += 1;
      const statusCode = error?.statusCode || "UNKNOWN";
      const errorMsg = error?.message || error;

      console.error(
        `[WebPush] Push failed for subscription ${subscription.id}: HTTP ${statusCode} (${errorMsg})`
      );

      // Remove expired/invalid subscriptions (404 Not Found / 410 Gone)
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: subscription.endpoint },
        });

        console.warn(
          `[WebPush] Removed expired/invalid subscription: ${subscription.id}`
        );
      }
    }
  }

  console.log(
    `[WebPush] Summary — found: ${subscriptions.length}, sent: ${sent}, failed: ${failed}`
  );

  return sent > 0;
}