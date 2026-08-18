import prisma from "../config/prisma.js";
import { Resend } from "resend";
import { sendPushNotification } from "./push.service.js";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function checkTargetPrice(
  listingId: string,
  currentPrice: number
) {
  const listing = await prisma.productListing.findUnique({
    where: { id: listingId },
    include: {
      marketplace: true,
      product: {
        include: {
          trackedProducts: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (!listing) {
    throw new Error("Listing not found.");
  }

  for (const tracking of listing.product.trackedProducts) {
    if (tracking.status !== "ACTIVE") continue;

    const targetPrice = Number(tracking.targetPrice);

    if (currentPrice > targetPrice) continue;

    const existingAlert = await prisma.alert.findUnique({
      where: {
        trackedProductId: tracking.id,
      },
    });

    if (existingAlert?.lastTriggeredAt) {
      continue;
    }

    const alert = await prisma.alert.upsert({
      where: {
        trackedProductId: tracking.id,
      },
      update: {
        isBelowTarget: true,
        lastTriggeredAt: new Date(),
      },
      create: {
        trackedProductId: tracking.id,
        isBelowTarget: true,
        lastTriggeredAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        alertId: alert.id,
        status: "PENDING",
      },
    });

    await resend.emails.send({
      from: "PricePulse <onboarding@resend.dev>",
      to: tracking.user.email,
      subject: `Price Alert: ${listing.product.title}`,
      html: `
        <h2>Price dropped! 🎉</h2>
        <p><b>${listing.product.title}</b></p>
        <p>${listing.marketplace.name}: ₹${currentPrice}</p>
        <p>Your target: ₹${targetPrice}</p>
        <a href="${listing.url}">View Product</a>
      `,
    });

    await sendPushNotification(
  tracking.user.id,
  `Price Alert: ${listing.product.title}`,
  `${listing.marketplace.name} price is now ₹${currentPrice}. Target: ₹${targetPrice}`
);
  }
}