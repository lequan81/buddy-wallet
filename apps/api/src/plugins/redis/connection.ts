/**
 * Redis Connection Module
 *
 * Handles TCP and REST connection to Redis/Upstash.
 * Provides connection state and availability checking.
 */
import { RedisClient } from 'bun';
import { log } from '@utils/logger';
import { circuitBreaker } from './circuit-breaker';

// Connection state
let redisClient: RedisClient | null = null;
let redisRestUrl: string | null = null;
let redisToken: string | null = null;
let useTcp: boolean = true;

// Configuration from environment
const REDIS_TCP_URL = Bun.env.REDIS_TCP_URL;
const REDIS_REST_URL = Bun.env.REDIS_REST_URL;
const REDIS_TOKEN = Bun.env.REDIS_TOKEN;
const REDIS_TCP_ENABLED = Bun.env.REDIS_TCP_ENABLED !== 'false';
const REDIS_ENABLED = Bun.env.REDIS_ENABLED === 'true';

/**
 * Initialize Redis connection (TCP or REST)
 */
export async function initRedis(): Promise<boolean> {
  if (!REDIS_ENABLED) {
    log.debug('REDIS', 'Disabled - using in-memory fallback');
    return false;
  }

  useTcp = REDIS_TCP_ENABLED;

  if (useTcp) {
    if (!REDIS_TCP_URL) {
      log.warn('REDIS', 'REDIS_TCP_URL not set - falling back to in-memory');
      return false;
    }

    try {
      const client = new RedisClient(REDIS_TCP_URL, {
        connectionTimeout: 5000,
        autoReconnect: true,
        maxRetries: 3,
        enableOfflineQueue: true
      });

      client.onconnect = () => log.debug('REDIS', 'Connected via TCP');
      client.onclose = (error) => {
        if (error) log.error('REDIS', 'TCP connection closed with error', { error: String(error) });
      };

      // Test connection
      await client.set('_health', 'ok');
      await client.del('_health');

      redisClient = client;
      log.debug('REDIS', 'TCP connection successful');
      return true;
    } catch (err) {
      log.error('REDIS', 'TCP connection failed, falling back to REST', { error: String(err) });
      useTcp = false;
    }
  }

  // REST fallback
  if (!REDIS_REST_URL || !REDIS_TOKEN) {
    log.warn('REDIS', 'REDIS_REST_URL or REDIS_TOKEN not set - using in-memory fallback');
    return false;
  }

  try {
    const response = await fetch(`${REDIS_REST_URL}/get/_health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    redisRestUrl = REDIS_REST_URL;
    redisToken = REDIS_TOKEN;
    log.debug('REDIS', 'REST connection successful');
    return true;
  } catch (err) {
    log.error('REDIS', 'REST connection failed - using in-memory fallback', { error: String(err) });
    return false;
  }
}

/**
 * Close Redis connection
 */
export function closeRedis(): void {
  if (redisClient) {
    redisClient.close();
    log.debug('REDIS', 'TCP connection closed');
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  if (!circuitBreaker.isAvailable()) return false;
  return useTcp ? redisClient !== null : redisRestUrl !== null && redisToken !== null;
}

/**
 * Get connection info for internal use
 */
export function getConnection() {
  return { client: redisClient, restUrl: redisRestUrl, token: redisToken, useTcp };
}

/**
 * Make a REST request to Redis
 */
export async function redisRequest(command: string, args: Record<string, any> = {}): Promise<any> {
  if (!redisRestUrl || !redisToken) throw new Error('Redis REST not available');

  const response = await fetch(`${redisRestUrl}/${command}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });

  if (!response.ok) throw new Error(`Redis REST error: ${response.status} ${response.statusText}`);

  const data = await response.json();
  return data.result;
}
