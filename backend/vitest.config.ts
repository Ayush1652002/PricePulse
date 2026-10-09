import { defineConfig } from "vitest/config";

// Tests use their own database. Set TEST_DATABASE_URL (the database name must contain "test").
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // All test files share one database, so they run one after another.
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret",
      DISABLE_RATE_LIMIT: "true",
      // Tests must not depend on whatever is written in your own .env file.
      REQUIRE_CSRF_HEADER: "false",
      BREVO_API_KEY: "test-key",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
    },
  },
});
