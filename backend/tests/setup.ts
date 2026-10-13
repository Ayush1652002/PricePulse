import dotenv from "dotenv";
dotenv.config();

// Fallbacks for test environment
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "dummy-client-id-for-ci-testing";
process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "dummy-public-key";
process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "dummy-private-key";
process.env.VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:test@example.com";

// Check TEST_DATABASE_URL first, fallback to DATABASE_URL
const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

if (!url || !/test/i.test(new URL(url).pathname)) {
  throw new Error(
    "Tests need TEST_DATABASE_URL pointing to a database whose name contains 'test' " +
      "(example: postgresql://user:pass@localhost:5432/pricepulse_test). Aborting to protect your data."
  );
}

// Ensure Prisma client connects to this test database during tests
process.env.DATABASE_URL = url;