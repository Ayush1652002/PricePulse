import prisma from "../config/prisma.js";
import nodemailer from "nodemailer";
import { sendPushNotification } from "./push.service.js";

// Gmail SMTP transporter — uses App Password, NOT your Gmail password.
// Generate one at: Google Account → Security → 2-Step Verification → App passwords
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

    // One alert per target-price cycle. Resetting the alert clears
    // lastTriggeredAt and allows a future price check to trigger again.
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

    const notification = await prisma.notification.create({
      data: {
        alertId: alert.id,
        status: "PENDING",
      },
    });

    let emailDelivered = false;
    let pushDelivered = false;

    // Email should not prevent push notification delivery if SMTP fails.
    try {
      await transporter.sendMail({
        from: `"PricePulse" <${process.env.SMTP_USER}>`,
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

      emailDelivered = true;
      console.log("Email sent to:", tracking.user.email);
    } catch (error) {
      console.error("Email notification failed:", error);
    }

    console.log("PUSH: Calling sendPushNotification...");

    try {
      pushDelivered = await sendPushNotification(
        tracking.user.id,
        `Price Alert: ${listing.product.title}`,
        `${listing.marketplace.name} price is now ₹${currentPrice}. Target: ₹${targetPrice}`
      );

      console.log("PUSH: Result =", pushDelivered);
    } catch (error) {
      console.error("PUSH: Failed =", error);
    }

    await prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        status: emailDelivered || pushDelivered ? "SENT" : "FAILED",
        sentAt:
          emailDelivered || pushDelivered ? new Date() : null,
      },
    });
  }
}