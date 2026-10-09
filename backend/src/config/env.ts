// Stops the server at startup (with a clear message) if a must-have variable is missing.
// Only variables the app cannot work without are checked here.
const REQUIRED = ["DATABASE_URL", "JWT_SECRET"] as const;

export function assertRequiredEnv() {
  const missing = REQUIRED.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Copy backend/.env.example to backend/.env and fill them in."
    );
    process.exit(1);
  }
}
