import jwt from "jsonwebtoken";
import prisma from "../../src/config/prisma.js";

// Empties every table (the database name was already checked in tests/setup.ts).
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "Notification","Alert","TrackedProduct","PriceHistory","ProductListing","Product","Marketplace","PushSubscription","OtpVerification","User" RESTART IDENTITY CASCADE`
  );
}

// Creates a user directly in the database and returns a login cookie for supertest.
export async function createUser(email: string) {
  const user = await prisma.user.create({
    data: { email, password: "", displayName: email.split("@")[0] },
  });
  const token = jwt.sign({ userId: user.id, email }, process.env.JWT_SECRET!, { algorithm: "HS256" });
  return { user, cookie: `token=${token}` };
}

export const amazonListing = (overrides: Record<string, unknown> = {}) => ({
  marketplace: "Amazon",
  externalId: "B0TEST1234",
  url: "https://www.amazon.in/dp/B0TEST1234",
  currentPrice: 1000,
  currency: "INR",
  ...overrides,
});
