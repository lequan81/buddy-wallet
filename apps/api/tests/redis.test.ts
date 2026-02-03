import { describe, test, expect, afterEach, beforeAll, afterAll } from 'bun:test';
import { RedisClient } from 'bun';

/**
 * Parse boolean env var with explicit default
 */
function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = Bun.env[key];
  if (value === undefined || value === null) return defaultValue;
  return value.toLowerCase() === 'true';
}

// Component-based config (matches connection.ts)
const REDIS_HOST = Bun.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Bun.env.REDIS_PORT || '6379';
const REDIS_PASSWORD = Bun.env.REDIS_PASSWORD;
const REDIS_TLS = getEnvBool('REDIS_TLS', false);

function buildTestRedisUrl(): string {
  const protocol = REDIS_TLS ? 'rediss' : 'redis';
  const url = new URL(`${protocol}://${REDIS_HOST}:${REDIS_PORT}`);
  if (REDIS_PASSWORD) url.password = REDIS_PASSWORD;
  return url.toString();
}

describe('Redis Integration', () => {
  const key = 'test:bun:hello';
  let redis: RedisClient;

  beforeAll(() => {
    redis = new RedisClient(buildTestRedisUrl());
  });

  afterAll(() => {
    redis.close();
  });

  afterEach(async () => {
    await redis.del(key);
  });

  test('should store and retrieve values', async () => {
    const value = 'Bun is fast';

    await redis.set(key, value);
    const result = await redis.get(key);

    expect(result).toBe(value);
  });

  test('should respond to PING', async () => {
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
  });
});
