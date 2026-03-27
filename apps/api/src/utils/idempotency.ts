/**
 * Idempotency Service
 * Prevents duplicate operations using Redis cache
 * Key format: idempotency:{key}
 * TTL: 24 hours
 */
import { cache, isRedisAvailable } from '../plugins/redis';
import { logger } from '@repo/logger';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface IdempotencyEntry<T> {
  response: T;
  createdAt: number;
}

/**
 * Check if an idempotency key exists and return cached response
 */
export async function getIdempotentResponse<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable() || !key) return null;

  try {
    const cached = await cache.get(`idempotency:${key}`);
    if (cached) {
      const entry = cached as IdempotencyEntry<T>;
      logger.info('Idempotency cache hit', { key, age: Date.now() - entry.createdAt });
      return entry.response;
    }
  } catch (error) {
    logger.error('Idempotency cache read failed', { error: String(error), key });
  }
  return null;
}

/**
 * Store response in idempotency cache
 */
export async function storeIdempotentResponse<T>(key: string, response: T): Promise<void> {
  if (!isRedisAvailable() || !key) return;

  try {
    const entry: IdempotencyEntry<T> = {
      response,
      createdAt: Date.now()
    };
    await cache.set(`idempotency:${key}`, entry, IDEMPOTENCY_TTL_SECONDS);
    logger.info('Idempotency response stored', { key, ttl: IDEMPOTENCY_TTL_SECONDS });
  } catch (error) {
    logger.error('Idempotency cache write failed', { error: String(error), key });
  }
}

/**
 * Clear idempotency key (useful for testing or manual cleanup)
 */
export async function clearIdempotencyKey(key: string): Promise<void> {
  if (!isRedisAvailable() || !key) return;

  try {
    await cache.del(`idempotency:${key}`);
    logger.info('Idempotency key cleared', { key });
  } catch (error) {
    logger.error('Idempotency cache delete failed', { error: String(error), key });
  }
}
