import "dotenv/config";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPriceAlertEmail(
  to: string,
  productTitle: string,
  currentPrice: number,
  targetPrice: number,
  currency: string
) {
  const { data, error } = await resend.emails.send({
    from: "PricePulse <onboarding@resend.dev>",
    to,
    subject: `Price dropped for ${productTitle}`,
    html: `
      <h2>Price Alert 🚨</h2>
      <p>The price of <strong>${productTitle}</strong> has dropped.</p>
      <p>Current price: <strong>${currency} ${currentPrice}</strong></p>
      <p>Your target price: <strong>${currency} ${targetPrice}</strong></p>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}