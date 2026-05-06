import { RedisClient } from 'bun';
import { logger } from '@repo/logger';
import { REDIS_CONFIG, buildRedisUrl } from '@repo/config';
import { withRetry } from '@repo/utils';
import type { ImportProgress } from '@repo/types';

let redisClient: RedisClient | null = null;
let connectionHealthy = false;

// ── Circuit Breaker State ───────────────────────────────────
let redisFailures = 0;
let lastFailure = 0;
const MAX_FAILURES = 3;
const CIRCUIT_RESET_MS = 60_000;

export async function initRedis(): Promise<boolean> {
  if (!REDIS_CONFIG.ENABLED) {
    logger.info('[Redis] Disabled in config');
    return false;
  }

  const redisUrl = buildRedisUrl();
  if (!redisUrl) {
    logger.warn('[Redis] URL not configured');
    return false;
  }

  return withRetry(
    async () => {
      let client: RedisClient | null = null;
      try {
        client = new RedisClient(redisUrl);

        client.onconnect = () => {
          logger.info('[Redis] Connected');
          connectionHealthy = true;
        };

        client.onclose = (error: Error | undefined) => {
          connectionHealthy = false;
          if (error) {
            logger.error('[Redis] Connection error', { error: String(error) });
          }
        };

        // Test connection
        await client.set('_health', 'ok');
        await client.del('_health');

        redisClient = client;
        connectionHealthy = true;
        return true;
      } catch (err) {
        if (client) client.close();
        connectionHealthy = false;
        throw err;
      }
    },
    {
      maxAttempts: REDIS_CONFIG.MAX_RETRIES || 5,
      baseDelayMs: REDIS_CONFIG.RETRY_BASE_DELAY_MS || 1000,
      maxDelayMs: REDIS_CONFIG.RETRY_MAX_DELAY_MS || 30000,
      onRetry: (err: unknown, attempt: number) => {
        logger.warn(`[Redis] Connection attempt ${attempt} failed, retrying...`, { error: String(err) });
      }
    }
  ).catch(() => false);
}

export function getRedis(): RedisClient {
  if (!redisClient || !connectionHealthy) {
    throw new Error('Redis not connected or unhealthy');
  }
  return redisClient;
}

export function closeRedis(): void {
  if (redisClient) {
    redisClient.close();
    redisClient = null;
  }
  connectionHealthy = false;
}

export function isRedisHealthy(): boolean {
  if (redisFailures >= MAX_FAILURES) {
    if (Date.now() - lastFailure > CIRCUIT_RESET_MS) {
      redisFailures = 0;
      logger.info('[Redis] Circuit breaker reset');
      return true;
    }
    return false;
  }
  return connectionHealthy;
}

export function onRedisSuccess(): void {
  if (redisFailures > 0) redisFailures--;
}

export function onRedisFailure(err: unknown): void {
  redisFailures++;
  lastFailure = Date.now();
  logger.error('[Redis] Operation failed', { error: String(err) });
}

// ── Progress Tracking ──────────────────────────────────────
const lastProgressUpdate = new Map<string, number>();
const PROGRESS_THROTTLE_MS = 1000;

export function setProgress(logId: string, progress: ImportProgress): void {
  if (!isRedisHealthy()) return;

  const now = Date.now();
  const last = lastProgressUpdate.get(logId) || 0;

  const isStatusChange = progress.status !== 'processing';
  if (!isStatusChange && now - last < PROGRESS_THROTTLE_MS) {
    return;
  }
  lastProgressUpdate.set(logId, now);

  try {
    const redis = getRedis();
    redis
      .send('HSET', [
        `bw:job:${logId}`,
        'progress', JSON.stringify(progress),
        'status', String(progress.status || 'processing')
      ])
      .then(() => {
        onRedisSuccess();
        // Refresh TTL
        redis.send('EXPIRE', [`bw:job:${logId}`, '3600']).catch(() => {});
      })
      .catch((err) => onRedisFailure(err));
  } catch {
    // Redis unavailable
  }
}

export function clearProgressCache(logId: string): void {
  lastProgressUpdate.delete(logId);
}
