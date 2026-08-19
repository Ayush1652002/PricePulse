import prisma from "../config/prisma.js";
import nodemailer from "nodemailer";
import { sendPushNotification } from "./push.service.js";

// Explicit host + port 587 (STARTTLS) to prevent IPv6 ENETUNREACH errors on cloud hosting (Render)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // use STARTTLS for port 587
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

    // One alert per target-price cycle.
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