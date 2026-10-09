import prisma from "../config/prisma.js";
import { sendPushNotification } from "./push.service.js";

// ---------- small helpers (exported so they can be unit-tested) ----------

// Makes text safe to put inside HTML (so a product title like "<script>" cannot become real HTML).
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only normal web links are allowed in the email button. Anything else becomes "#".
export function safeHttpUrl(value: string): string {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "#";
  } catch {
    return "#";
  }
}

export function formatPrice(currency: string | null | undefined, amount: number): string {
  if (!currency || currency === "INR") return `₹${amount}`;
  if (currency === "USD") return `$${amount}`;
  return `${currency} ${amount}`;
}

// ---------- main logic ----------

/**
 * Called after every price check of one listing.
 *
 * Rule: a user gets ONE notification when the price goes from "above target" to "at or below target".
 * When the price goes back above the target, the alert is re-armed so the next drop notifies again.
 */
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
              // Only what we need (the full user row also contains the password hash).
              user: { select: { id: true, email: true } },
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

    // Price is above target: re-arm the alert (if it was "reached" before) and move on.
    if (currentPrice > targetPrice) {
      await prisma.alert.updateMany({
        where: { trackedProductId: tracking.id, isBelowTarget: true },
        data: { isBelowTarget: false },
      });
      continue;
    }

    // Make sure an alert row exists (created "not reached yet"). "skipDuplicates" means: if another
    // check created it a moment ago, do nothing (a plain upsert can fail when two checks race).
    await prisma.alert.createMany({
      data: [{ trackedProductId: tracking.id, isBelowTarget: false }],
      skipDuplicates: true,
    });

    // Claim the notification in ONE database step. If two price checks run at the same time,
    // only one of them sees count === 1 and sends the notification.
    const claimed = await prisma.alert.updateMany({
      where: { trackedProductId: tracking.id, isBelowTarget: false },
      data: { isBelowTarget: true, lastTriggeredAt: new Date() },
    });

    if (claimed.count === 0) continue;

    const alert = await prisma.alert.findUniqueOrThrow({
      where: { trackedProductId: tracking.id },
    });

    const notification = await prisma.notification.create({
      data: {
        alertId: alert.id,
        status: "PENDING",
      },
    });

    dispatchNotifications({
      notificationId: notification.id,
      userEmail: tracking.user.email,
      userId: tracking.user.id,
      productTitle: tracking.customTitle ?? listing.product.title,
      marketplaceName: listing.marketplace.name,
      currency: listing.currency,
      currentPrice,
      targetPrice,
      productUrl: listing.url,
    }).catch((err) => console.error("Background dispatch error:", err));
  }
}

type DispatchInput = {
  notificationId: string;
  userEmail: string;
  userId: string;
  productTitle: string;
  marketplaceName: string;
  currency: string | null;
  currentPrice: number;
  targetPrice: number;
  productUrl: string;
};

async function dispatchNotifications(input: DispatchInput) {
  const {
    notificationId,
    userEmail,
    userId,
    productTitle,
    marketplaceName,
    currency,
    currentPrice,
    targetPrice,
    productUrl,
  } = input;

  let emailDelivered = false;
  let pushDelivered = false;

  const senderEmail = process.env.SMTP_USER || "alerts@pricepulse.app";
  const current = formatPrice(currency, currentPrice);
  const target = formatPrice(currency, targetPrice);

  if (process.env.BREVO_API_KEY) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          sender: { name: "PricePulse", email: senderEmail },
          to: [{ email: userEmail }],
          subject: `Price Alert: ${productTitle}`,
          htmlContent: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #7c3aed;">Price dropped! 🎉</h2>
              <p style="font-size: 16px;"><b>${escapeHtml(productTitle)}</b></p>
              <p style="font-size: 18px; color: #16a34a;"><b>${escapeHtml(marketplaceName)}: ${escapeHtml(current)}</b></p>
              <p>Your target price: ${escapeHtml(target)}</p>
              <br/>
              <a href="${escapeHtml(safeHttpUrl(productUrl))}" style="background-color: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Product</a>
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
      `${marketplaceName} price is now ${current}. Target: ${target}`
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
