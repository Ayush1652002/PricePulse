import prisma from "../config/prisma.js";
import { sendPushNotification } from "./push.service.js";

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

    const notification = await prisma.notification.create({
      data: {
        alertId: alert.id,
        status: "PENDING",
      },
    });

    dispatchNotifications(
      notification.id,
      tracking.user.email,
      tracking.user.id,
      listing.product.title,
      listing.marketplace.name,
      currentPrice,
      targetPrice,
      listing.url
    ).catch((err) => console.error("Background dispatch error:", err));
  }
}

async function dispatchNotifications(
  notificationId: string,
  userEmail: string,
  userId: string,
  productTitle: string,
  marketplaceName: string,
  currentPrice: number,
  targetPrice: number,
  productUrl: string
) {
  let emailDelivered = false;
  let pushDelivered = false;

  const senderEmail = process.env.SMTP_USER || "alerts@pricepulse.app";

  if (process.env.BREVO_API_KEY) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "PricePulse", email: senderEmail },
          to: [{ email: userEmail }],
          subject: `Price Alert: ${productTitle}`,
          htmlContent: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #7c3aed;">Price dropped! 🎉</h2>
              <p style="font-size: 16px;"><b>${productTitle}</b></p>
              <p style="font-size: 18px; color: #16a34a;"><b>${marketplaceName}: ₹${currentPrice}</b></p>
              <p>Your target price: ₹${targetPrice}</p>
              <br/>
              <a href="${productUrl}" style="background-color: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Product</a>
            </div>
          `,
        }),
      });

      if (response.ok) {
        emailDelivered = true;
        console.log("Brevo email sent to:", userEmail);
      } else {
        const errorText = await response.text();
        console.error("Brevo email failed API response:", response.status, errorText);
      }
    } catch (error) {
      console.error("Brevo email fetch error:", error);
    }
  } else {
    console.warn("BREVO_API_KEY environment variable is not set.");
  }

  try {
    pushDelivered = await sendPushNotification(
      userId,
      `Price Alert: ${productTitle}`,
      `${marketplaceName} price is now ₹${currentPrice}. Target: ₹${targetPrice}`
    );
  } catch (error) {
    console.error("PUSH: Failed =", error);
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: emailDelivered || pushDelivered ? "SENT" : "FAILED",
      sentAt: emailDelivered || pushDelivered ? new Date() : null,
    },
  });
}