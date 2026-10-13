import dotenv from "dotenv";
dotenv.config();

// Fallback for CI/test environment (leave VAPID undefined so web-push avoids 65-byte decode error)
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "dummy-client-id-for-ci-testing";

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