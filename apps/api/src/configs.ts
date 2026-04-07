import {
  BACKEND_CONSTANTS,
  optionalEnv,
  requiredEnv,
  loadAndValidateEnv,
  getEnvBool,
  getEnvInt,
  SHARED_CONSTANTS,
  TIMEOUTS
} from '@repo/config';
import { logger } from '@repo/logger';

/**
 * Startup Validation - Ensures environment is ready
 */
const nodeEnv = Bun.env.NODE_ENV || 'development';

let envValidated = false;
export const validateRuntimeEnv = (): void => {
  if (envValidated || nodeEnv === 'test') {
    return;
  }
  loadAndValidateEnv();
  envValidated = true;
};

const resolveRequiredEnv = (key: string, testFallback: string): string => {
  const value = optionalEnv(key, '');
  if (value) {
    return value;
  }
  if (nodeEnv === 'test') {
    return testFallback;
  }
  return requiredEnv(key);
};

const jwtSecret = resolveRequiredEnv('JWT_SECRET', 'test-jwt-secret-only-for-tests-0123456789');
const refreshSecret = resolveRequiredEnv(
  'JWT_REFRESH_SECRET',
  'test-refresh-secret-only-for-tests-0123456789'
);

/**
 * Minified Config Definition
 * 
 * Priorities:
 * 1. .env variables (highest)
 * 2. BACKEND_CONSTANTS / SHARED_CONSTANTS (fallbacks)
 */
export const configs = {
  APP: {
    NODE_ENV: nodeEnv,
    PORT: optionalEnv('PORT', '3000'),
    WEB_URL: optionalEnv('WEB_URL', 'http://localhost:5173'),
    IS_PRODUCTION: nodeEnv === 'production'
  },
  AUTH: {
    JWT_SECRET: jwtSecret,
    JWT_REFRESH_SECRET: refreshSecret,
    CSRF_SECRET: optionalEnv('CSRF_SECRET', jwtSecret),
    ACCESS_TOKEN_LIFETIME: getEnvInt('ACCESS_TOKEN_LIFETIME', 900000),
    REFRESH_TOKEN_LIFETIME: getEnvInt('REFRESH_TOKEN_LIFETIME', 7776000000),
    JWT_BLACKLIST_SECONDS: getEnvInt('JWT_BLACKLIST_SECONDS', 900),
    PASSWORD_MIN_LENGTH: getEnvInt('AUTH_PASSWORD_MIN_LENGTH', SHARED_CONSTANTS.USER.PASSWORD_MIN_LENGTH),
    FETCH_TIMEOUT_MS: getEnvInt('API_FETCH_TIMEOUT_MS', TIMEOUTS.API_FETCH_MS),

    ARGON2_OPTIONS: {
      algorithm: 'argon2id' as const,
      memoryCost: getEnvInt('ARGON2_MEMORY_COST', 65536),
      timeCost: getEnvInt('ARGON2_TIME_COST', 3)
    },

    OTP: {
      EXPIRY_MINUTES: getEnvInt('AUTH_OTP_EXPIRY_MINUTES', SHARED_CONSTANTS.AUTH.OTP_EXPIRY_MINUTES),
      RESEND_COOLDOWN_SECONDS: getEnvInt('AUTH_OTP_RESEND_COOLDOWN_SECONDS', SHARED_CONSTANTS.AUTH.OTP_RESEND_COOLDOWN_SECONDS),
      MAX_RESENDS_PER_HOUR: getEnvInt('AUTH_OTP_MAX_RESENDS_PER_HOUR', SHARED_CONSTANTS.AUTH.OTP_MAX_RESENDS_PER_HOUR),
      MAX_ATTEMPTS: getEnvInt('AUTH_OTP_MAX_ATTEMPTS', SHARED_CONSTANTS.AUTH.OTP_MAX_ATTEMPTS)
    },
    PASSWORD_RESET: {
      EXPIRY_HOURS: getEnvInt('AUTH_PASSWORD_RESET_EXPIRY_HOURS', SHARED_CONSTANTS.AUTH.TEMP_PASSWORD_EXPIRY_HOURS)
    }
  },
  CACHE: {
    VIETQR_TTL: getEnvInt('CACHE_VIETQR_TTL', 86400)
  },
  IMPORT: {
    MAX_ROWS: getEnvInt('IMPORT_MAX_ROWS', SHARED_CONSTANTS.IMPORT.MAX_ROWS),
    STALE_LOG_LIFETIME: getEnvInt('IMPORT_STALE_LOG_LIFETIME', SHARED_CONSTANTS.IMPORT.STALE_LOG_LIFETIME),
    CHUNK_SIZE: getEnvInt('IMPORT_CHUNK_SIZE', SHARED_CONSTANTS.IMPORT.CHUNK_SIZE)
  },
  STORAGE: {
    S3_ENDPOINT: optionalEnv('S3_ENDPOINT', ''),
    S3_REGION: optionalEnv('S3_REGION', ''),
    S3_BUCKET: optionalEnv('S3_BUCKET', ''),
    S3_ACCESS_KEY_ID: optionalEnv('S3_ACCESS_KEY_ID', ''),
    S3_SECRET_ACCESS_KEY: optionalEnv('S3_SECRET_ACCESS_KEY', ''),
    S3_PUBLIC_BASE_URL: optionalEnv('S3_PUBLIC_BASE_URL', ''),
    S3_FORCE_PATH_STYLE: getEnvBool('S3_FORCE_PATH_STYLE', true)
  },
  PAGINATION: {
    DEFAULT_LIMIT: getEnvInt('PAGINATION_DEFAULT_LIMIT', SHARED_CONSTANTS.PAGINATION.DEFAULT_SIZE),
    MAX_LIMIT: getEnvInt('PAGINATION_MAX_LIMIT', SHARED_CONSTANTS.PAGINATION.MAX_SIZE),
    MAX_OFFSET: getEnvInt('PAGINATION_MAX_OFFSET', 50000)
  },
  RATE_LIMITS: {
    STANDARD: { windowMs: 60000, maxRequests: 100 },
    STRICT: { windowMs: 60000, maxRequests: 5 },
    AUTH: { windowMs: 60000, maxRequests: 10 },
    AUTH_RECOVERY: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    AUTH_RESET: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
    AUTH_OTP: { windowMs: 10 * 60 * 1000, maxRequests: 5 },
    BURST: { windowMs: 10000, maxRequests: 30 },
    UPLOAD: {
      windowMs: BACKEND_CONSTANTS.RATE_LIMITS.UPLOAD.windowMs,
      maxRequests: BACKEND_CONSTANTS.RATE_LIMITS.UPLOAD.requests
    },
    DOWNLOAD: { windowMs: 60000, maxRequests: 100 },
    BROADCAST: { windowMs: 60000, maxRequests: 1 },
    DELETE: { windowMs: 60000, maxRequests: 20 }
  },
  PUSH: {
    VAPID_PUBLIC_KEY: optionalEnv('VAPID_PUBLIC_KEY', ''),
    VAPID_PRIVATE_KEY: optionalEnv('VAPID_PRIVATE_KEY', ''),
    VAPID_SUBJECT: optionalEnv('VAPID_SUBJECT', 'mailto:example@yourdomain.com'),
    MAX_FAILED_ATTEMPTS: getEnvInt('PUSH_MAX_FAILED_ATTEMPTS', 3)
  },
  SECURITY: {
    DEBT_CHECK_COUNT_TOKEN: optionalEnv('DEBT_CHECK_COUNT_TOKEN', ''),
    TURNSTILE_SECRET: optionalEnv('TURNSTILE_SECRET', '')
  }
} as const;

// Storage validation logging
if (configs.APP.IS_PRODUCTION && (!configs.STORAGE.S3_ENDPOINT || !configs.STORAGE.S3_BUCKET)) {
  logger.warn('S3 is not fully configured. Some features may be disabled.');
}
