/**
 * Redis Connection Module
 *
 * Handles TCP connection to Redis using Bun's native RedisClient.
 * Uses component-based config (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TLS).
 */
import { RedisClient } from 'bun';
import { log } from '@repo/logger';
import { circuitBreaker } from './circuit-breaker';

// Connection state
let redisClient: RedisClient | null = null;
let connectionHealthy = false;

/**
 * Parse boolean env var with explicit default
 * - 'true' → true
 * - undefined/null/'false'/anything else → defaultValue (false)
 */
function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = Bun.env[key];
  if (value === undefined || value === null) return defaultValue;
  return value.toLowerCase() === 'true';
}

// Component-based configuration (readable in .env)
const REDIS_HOST = Bun.env.REDIS_HOST || 'anonychat.vinaddns.com';
const REDIS_PORT = Bun.env.REDIS_PORT || '13409';
const REDIS_PASSWORD = Bun.env.REDIS_PASSWORD || 'PhamAnhSaoKhue@130409_lequan81!';
const REDIS_TLS = getEnvBool('REDIS_TLS', true); // Enable TLS for secure connection
const REDIS_ENABLED = getEnvBool('REDIS_ENABLED', true); // Enable Redis by default

/**
 * Build Redis URL from components (auto-encodes password)
 */
function buildRedisUrl(): string | undefined {
  if (!REDIS_HOST) return undefined;

  const protocol = REDIS_TLS ? 'rediss' : 'redis';
  const url = new URL(`${protocol}://${REDIS_HOST}:${REDIS_PORT}`);
  if (REDIS_PASSWORD) url.password = REDIS_PASSWORD;

  return url.toString();
}

/**
 * Initialize Redis connection
 */
export async function initRedis(): Promise<boolean> {
  if (!REDIS_ENABLED) {
    log.debug('REDIS', 'Disabled - using in-memory fallback');
    return false;
  }

  const redisUrl = buildRedisUrl();
  if (!redisUrl) {
    log.warn('REDIS', 'REDIS_HOST not set - using in-memory fallback');
    return false;
  }

  try {
    const client = new RedisClient(redisUrl, {
      connectionTimeout: 10000, // Increased timeout
      autoReconnect: true,
      maxRetries: 5, // More retries
      enableOfflineQueue: true
    });

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
      host: REDIS_HOST,
      port: REDIS_PORT,
      tls: REDIS_TLS
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
