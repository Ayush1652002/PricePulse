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
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

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
        JSON.stringify({ title, body })
      );

      delivered += 1;
       } catch (error: any) {
      const statusCode = error?.statusCode;
      const responseBody = error?.body;

      console.error("PUSH ERROR:", {
        statusCode,
        message: error?.message,
        body: responseBody,
      });

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
