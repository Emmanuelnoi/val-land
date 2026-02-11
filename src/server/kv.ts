import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('KV not configured');
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  return redis.get<T>(key);
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const redis = getRedis();
  await redis.set(key, value);
}

export async function kvAppend<T>(key: string, value: T, maxItems = 200): Promise<T[]> {
  const redis = getRedis();
  const existing = (await redis.get<T[]>(key)) ?? [];
  const next = [...existing, value];
  const capped = next.length > maxItems ? next.slice(-maxItems) : next;
  await redis.set(key, capped);
  return capped;
}
