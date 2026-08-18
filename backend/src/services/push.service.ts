import webpush from "web-push";
import prisma from "../config/prisma.js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string
) {
  const subscriptions =
    await prisma.pushSubscription.findMany({
      where: { userId },
    });

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
        })
      );
    } catch (error: any) {
      console.error(
        "Push notification failed:",
        error.message
      );
    }
  }
}