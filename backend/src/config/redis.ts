import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;

export const redisConnection = redisUrl
  ? {
      url: redisUrl,
      tls: redisUrl.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
    }
  : {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    };

/**
 * Performs a fast non-blocking ping to check if Redis is alive.
 * Returns true if connected, false otherwise.
 */
export async function testRedisConnection(): Promise<boolean> {
  const client = redisUrl
    ? new Redis(redisUrl, {
        tls: redisUrl.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      })
    : new Redis({
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });

  try {
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch (error) {
    try {
      client.disconnect();
    } catch {}
    return false;
  }
}