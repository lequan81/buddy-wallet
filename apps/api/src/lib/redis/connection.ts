/**
 * Redis Connection Module
 *
 * Handles TCP connection to Redis using Bun's native RedisClient.
 */
import { RedisClient } from 'bun';
import { log } from '@repo/logger';
import { REDIS_CONFIG, buildRedisUrl } from '@repo/config';
import { circuitBreaker } from './circuit-breaker';

// Connection state
let redisClient: RedisClient | null = null;
let connectionHealthy = false;

/**
 * Initialize Redis connection
 */
export async function initRedis(): Promise<boolean> {
  if (!REDIS_CONFIG.ENABLED) {
    log.debug('REDIS', 'Disabled - using in-memory fallback');
    return false;
  }

  const redisUrl = buildRedisUrl();
  if (!redisUrl) {
    log.warn('REDIS', 'REDIS_HOST not set - using in-memory fallback');
    return false;
  }

  try {
    const client = new RedisClient(redisUrl);

    client.onconnect = () => {
      log.debug('REDIS', 'Connected via TCP');
      connectionHealthy = true;
    };
    client.onclose = (error: Error | undefined) => {
      connectionHealthy = false;
      if (error) log.error('REDIS', 'Connection closed with error', { error: String(error) });
    };

    // Test connection with timeout
    const testPromise = client.set('_health', 'ok');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection test timeout')), 5000)
    );

    await Promise.race([testPromise, timeoutPromise]);
    await client.del('_health');

    redisClient = client;
    connectionHealthy = true; // Mark as healthy after successful connection
    log.info('REDIS', 'Connection successful', {
      host: REDIS_CONFIG.HOST,
      port: REDIS_CONFIG.PORT,
      tls: REDIS_CONFIG.TLS
    });
    return true;
  } catch (err) {
    log.error('REDIS', 'Connection failed - using in-memory fallback', { error: String(err) });
    return false;
  }
}

/**
 * Close Redis connection
 */
export function closeRedis(): void {
  if (redisClient) {
    redisClient.close();
    redisClient = null;
    connectionHealthy = false;
    log.debug('REDIS', 'Connection closed');
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  if (!circuitBreaker.isAvailable()) return false;
  if (!redisClient) return false;
  if (!connectionHealthy) return false;
  return true;
}

/**
 * Get Redis client for internal use
 */
export function getClient(): RedisClient | null {
  return redisClient;
}
