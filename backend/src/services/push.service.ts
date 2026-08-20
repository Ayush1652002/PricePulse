import webpush from "web-push";
import prisma from "../config/prisma.js";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:alerts@pricepulse.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn("VAPID keys are missing from environment variables.");
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn("Push skipped: VAPID keys not configured.");
    return false;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    console.log(`No push subscriptions found for user ${userId}.`);
    return false;
  }

  let delivered = 0;

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

      delivered += 1;
      console.log(`PUSH: Delivered successfully to subscription ${subscription.id}`);
    } catch (error: any) {
      const statusCode = error?.statusCode;
      const responseBody = error?.body;

      console.error("PUSH ERROR:", {
        statusCode,
        message: error?.message,
        body: responseBody,
      });

      // Remove expired/invalid subscriptions automatically (Multi-device management)
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: subscription.endpoint },
        });

        console.warn(
          `Removed expired push subscription for user ${userId}.`
        );
      }
    }
  }

  return delivered > 0;
}