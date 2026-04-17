import { env } from '../env';

/**
 * Redis Configuration
 * 
 * NOTE: Values here are DEFAULTS. Local .env takes priority.
 */
export const REDIS_CONFIG = {
  ENABLED: env.bool('REDIS_ENABLED', true),
  HOST: env.string('REDIS_HOST', 'localhost'),
  PORT: env.int('REDIS_PORT', 6379),
  PASSWORD: env.string('REDIS_PASSWORD', ''),
  TLS: env.bool('REDIS_TLS', false),
  MAX_RETRIES: env.int('REDIS_MAX_RETRIES', 5),
  RETRY_BASE_DELAY_MS: env.int('REDIS_RETRY_BASE_DELAY', 1000),
  RETRY_MAX_DELAY_MS: env.int('REDIS_RETRY_MAX_DELAY', 30000)
} as const;

/**
 * Build Redis connection URL
 */
export const buildRedisUrl = (): string => {
  if (!REDIS_CONFIG.HOST) return '';
  const protocol = REDIS_CONFIG.TLS ? 'rediss' : 'redis';
  const auth = REDIS_CONFIG.PASSWORD ? `:${encodeURIComponent(REDIS_CONFIG.PASSWORD)}@` : '';

  return `${protocol}://${auth}${REDIS_CONFIG.HOST}:${REDIS_CONFIG.PORT}`;
};
