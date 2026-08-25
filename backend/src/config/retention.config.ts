/**
 * 📊 Centralized PriceHistory Retention Configuration
 *
 * Configurable via environment variables (.env).
 */
export const PRICE_HISTORY_RETENTION = {
  /**
   * Retention Strategy:
   * - "COUNT" : Keep the latest N records per listing (default)
   * - "DAYS"  : Keep all records within the last N days
   */
  strategy: (process.env.PRICE_HISTORY_RETENTION_STRATEGY?.toUpperCase() === "DAYS"
    ? "DAYS"
    : "COUNT") as "COUNT" | "DAYS",

  /**
   * For "COUNT" strategy:
   * Maximum number of latest price history records to keep per listing.
   * Default: 30
   */
  maxRecords: Number(process.env.PRICE_HISTORY_MAX_RECORDS) || 30,

  /**
   * For "DAYS" strategy:
   * Number of days of price history to retain per listing.
   * Default: 30
   */
  retentionDays: Number(process.env.PRICE_HISTORY_RETENTION_DAYS) || 30,
};