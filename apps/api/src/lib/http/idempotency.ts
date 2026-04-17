/**
 * Idempotency Helpers & Service
 * Prevents duplicate operations using Redis cache and standardized headers.
 * Key format: idempotency:{key}
 * TTL: 24 hours
 */
import { cache, isRedisAvailable } from '@/lib/redis';
import { logger } from '@repo/logger';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_REPLAY_HEADER = 'Idempotency-Replay';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface IdempotencyEntry<T> {
  response: T;
  createdAt: number;
}

type MutableHeaders = Record<string, string>;

const getMutableHeaders = (set: { headers?: unknown }): MutableHeaders => {
  if (!set.headers || typeof set.headers !== 'object') {
    set.headers = {};
  }
  return set.headers as MutableHeaders;
};

/**
 * Standardize idempotency headers for the response
 */
export const setIdempotencyHeaders = (
  set: { headers?: unknown },
  key: string,
  options?: { replay?: boolean }
): void => {
  const headers = getMutableHeaders(set);
  headers[IDEMPOTENCY_KEY_HEADER] = key;
  headers['X-Idempotency-Key'] = key;

  if (options?.replay) {
    headers[IDEMPOTENCY_REPLAY_HEADER] = 'true';
    headers['X-Idempotency-Replay'] = 'true';
  }
};

/**
 * Extract idempotency key from request headers
 */
export const getIdempotencyKey = (headers: Record<string, string | undefined>): string | undefined => {
  // Try canonical and lowercase versions
  return (
    headers['idempotency-key'] ||
    headers[IDEMPOTENCY_KEY_HEADER] ||
    headers['x-idempotency-key']
  );
};

/* ── Redis Persistence Logic ────────────────────────────────────────── */

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
 * Clear idempotency key
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
