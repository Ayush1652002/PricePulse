/**
 * ⏱️ Centralized Price-Check Scheduler Configuration
 *
 * Configurable via PRICE_CHECK_INTERVAL_MINUTES in .env
 *
 * Examples:
 * - PRICE_CHECK_INTERVAL_MINUTES=5  (every 5 minutes - default)
 * - PRICE_CHECK_INTERVAL_MINUTES=10 (every 10 minutes)
 * - PRICE_CHECK_INTERVAL_MINUTES=60 (every 1 hour)
 */
export const PRICE_CHECK_INTERVAL_MINUTES =
  Number(process.env.PRICE_CHECK_INTERVAL_MINUTES) || 5;

export const PRICE_CHECK_INTERVAL_MS =
  PRICE_CHECK_INTERVAL_MINUTES * 60 * 1000;