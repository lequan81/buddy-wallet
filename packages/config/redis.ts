/**
 * Shared Redis Configuration
 *
 * Used by both apps/api and apps/worker for consistent Redis connection.
 */
import { getEnvBool, optionalEnv, getEnvInt } from './env';

export const REDIS_CONFIG = {
  HOST: optionalEnv('REDIS_HOST', 'localhost'),
  PORT: optionalEnv('REDIS_PORT', '6379'),
  PASSWORD: Bun?.env?.REDIS_PASSWORD || process.env.REDIS_PASSWORD,
  TLS: getEnvBool('REDIS_TLS', false),
  ENABLED: getEnvBool('REDIS_ENABLED', true),
  CONNECTION_TIMEOUT: getEnvInt('REDIS_CONNECTION_TIMEOUT', 10000),
  MAX_RETRIES: getEnvInt('REDIS_MAX_RETRIES', 5)
} as const;

/**
 * Build Redis URL from config
 */
export function buildRedisUrl(): string | undefined {
  if (!REDIS_CONFIG.HOST) return undefined;
  
  const protocol = REDIS_CONFIG.TLS ? 'rediss' : 'redis';
  const url = new URL(`${protocol}://${REDIS_CONFIG.HOST}:${REDIS_CONFIG.PORT}`);
  
  if (REDIS_CONFIG.PASSWORD) {
    url.password = REDIS_CONFIG.PASSWORD;
  }
  
  return url.toString();
}

/**
 * Get Redis connection options for RedisClient
 */
export function getRedisOptions() {
  return {
    connectionTimeout: REDIS_CONFIG.CONNECTION_TIMEOUT,
    autoReconnect: true,
    maxRetries: REDIS_CONFIG.MAX_RETRIES,
    enableOfflineQueue: true
  };
}
