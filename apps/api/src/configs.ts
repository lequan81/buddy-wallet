import {
  BACKEND_CONSTANTS,
  loadAndValidateEnv,
  env,
  SHARED_CONSTANTS,
  TIMEOUTS
} from '@repo/config';
import { logger } from '@repo/logger';

// ============================================
// TOKEN LIFETIME CONSTANTS (milliseconds)
// ============================================
/** JWT access token lifetime: 15 minutes */
const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000;  // 900000 ms

/** JWT refresh token lifetime: 90 days */
const REFRESH_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;  // 7776000000 ms

/** JWT token blacklist/revocation TTL: 15 minutes */
const JWT_BLACKLIST_SECONDS = 15 * 60;  // 900 seconds

// ============================================
// RATE LIMIT CONSTANTS
// ============================================
/** Rate limit window: 1 minute */
const RATE_LIMIT_WINDOW_1MIN = 60000;

/** Rate limit window: 10 seconds (for burst limiting) */
const RATE_LIMIT_WINDOW_10SEC = 10000;

/** Rate limit window: 10 minutes (for email verification) */
const RATE_LIMIT_WINDOW_10MIN = 10 * 60 * 1000;

/** Rate limit window: 15 minutes */
const RATE_LIMIT_WINDOW_15MIN = 15 * 60 * 1000;

/** Rate limit window: 24 hours (for daily limits) */
const RATE_LIMIT_WINDOW_24HOUR = 24 * 60 * 60 * 1000;

/** Rate limit window: 1 hour (for strictest auth limits) */
const RATE_LIMIT_WINDOW_1HOUR = 60 * 60 * 1000;

/** Standard rate limit: 100 requests per minute */
const RATE_LIMIT_STANDARD_REQUESTS = 100;

/** Strict rate limit: 5 requests per minute */
const RATE_LIMIT_STRICT_REQUESTS = 5;

/** Login rate limit: 20 attempts per hour (CRITICAL: brute-force protection) */
const RATE_LIMIT_LOGIN_REQUESTS = 20;

/** Signup rate limit: 10 attempts per hour (CRITICAL: spam prevention) */
const RATE_LIMIT_SIGNUP_REQUESTS = 10;

/** Password reset rate limit: 5 attempts per 24 hours (CRITICAL: email spam prevention) */
const RATE_LIMIT_PASSWORD_RESET_REQUESTS = 5;

/** Email verification/OTP resend: 6 attempts per hour */
const RATE_LIMIT_EMAIL_VERIFY_REQUESTS = 6;

/** OTP attempt rate limit: 5 attempts per 10 minutes */
const RATE_LIMIT_OTP_ATTEMPTS = 5;

/** Burst rate limit: 30 requests per 10 seconds */
const RATE_LIMIT_BURST_REQUESTS = 30;

/** Download rate limit: 100 requests per minute */
const RATE_LIMIT_DOWNLOAD_REQUESTS = 100;

/** Broadcast rate limit: 1 request per minute */
const RATE_LIMIT_BROADCAST_REQUESTS = 1;

/** Delete rate limit: 20 requests per minute */
const RATE_LIMIT_DELETE_REQUESTS = 20;

// ============================================
// CACHE TTL CONSTANTS (seconds)
// ============================================
/** VietQR API response cache TTL: 1 day */
const CACHE_VIETQR_TTL_SECONDS = 24 * 60 * 60;  // 86400 seconds

// ============================================
// PAGINATION CONSTANTS
// ============================================
/** Maximum offset value for pagination (prevents massive queries) */
const PAGINATION_MAX_OFFSET = 50000;

// ============================================
// CRYPTOGRAPHY CONSTANTS
// ============================================
/** Argon2 memory cost: 64 MB (balanced security/perf) */
const ARGON2_MEMORY_COST = 65536;

/** Argon2 time cost: 3 iterations */
const ARGON2_TIME_COST = 3;

// ============================================
// EMAIL SMTP CONSTANTS
// ============================================
/** SMTP connection pool size */
const SMTP_POOL_SIZE = 5;

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

/**
 * Require environment variable - Never allows fallback for security-sensitive values
 * @throws Error if variable is not set
 */
const mustEnv = (key: string): string => {
  const value = env.string(key, '');
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `This is a security-critical secret that must be explicitly provided.\n` +
      `Set it in your .env file: ${key}=<your-secret-value>`
    );
  }
  return value;
};

const jwtSecret = mustEnv('JWT_SECRET');
const legacySmtpPassword = env.string('SMTP_PASS', '');
const smtpPassword = env.string('SMTP_PASSWORD', legacySmtpPassword);

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
    PORT: env.string('PORT', '3000'),
    WEB_URL: env.string('WEB_URL', 'http://localhost:5173'),
    IS_PRODUCTION: nodeEnv === 'production'
  },
  AUTH: {
    JWT_SECRET: jwtSecret,
    JWT_REFRESH_SECRET: jwtSecret, // Use same secret for refresh tokens
    CSRF_SECRET: env.string('CSRF_SECRET', jwtSecret),
    ACCESS_TOKEN_LIFETIME: env.int('ACCESS_TOKEN_LIFETIME', ACCESS_TOKEN_LIFETIME_MS),
    REFRESH_TOKEN_LIFETIME: env.int('REFRESH_TOKEN_LIFETIME', REFRESH_TOKEN_LIFETIME_MS),
    JWT_BLACKLIST_SECONDS: env.int('JWT_BLACKLIST_SECONDS', JWT_BLACKLIST_SECONDS),
    PASSWORD_MIN_LENGTH: env.int('AUTH_PASSWORD_MIN_LENGTH', SHARED_CONSTANTS.USER.PASSWORD_MIN_LENGTH),
    PASSWORD_RESET_TOKEN_LIFETIME: env.int('PASSWORD_RESET_TOKEN_LIFETIME', 21600000), // 6 hours
    FETCH_TIMEOUT_MS: env.int('API_FETCH_TIMEOUT_MS', TIMEOUTS.API_FETCH_MS),

    ARGON2_OPTIONS: {
      algorithm: 'argon2id' as const,
      memoryCost: env.int('ARGON2_MEMORY_COST', ARGON2_MEMORY_COST),
      timeCost: env.int('ARGON2_TIME_COST', ARGON2_TIME_COST)
    },

    OTP: {
      EXPIRY_MINUTES: env.int('AUTH_OTP_EXPIRY_MINUTES', SHARED_CONSTANTS.AUTH.OTP_EXPIRY_MINUTES),
      RESEND_COOLDOWN_SECONDS: env.int('AUTH_OTP_RESEND_COOLDOWN_SECONDS', SHARED_CONSTANTS.AUTH.OTP_RESEND_COOLDOWN_SECONDS),
      MAX_RESENDS_PER_HOUR: env.int('AUTH_OTP_MAX_RESENDS_PER_HOUR', SHARED_CONSTANTS.AUTH.OTP_MAX_RESENDS_PER_HOUR),
      MAX_ATTEMPTS: env.int('AUTH_OTP_MAX_ATTEMPTS', SHARED_CONSTANTS.AUTH.OTP_MAX_ATTEMPTS)
    },
    PASSWORD_RESET: {
      EXPIRY_HOURS: env.int('AUTH_PASSWORD_RESET_EXPIRY_HOURS', SHARED_CONSTANTS.AUTH.TEMP_PASSWORD_EXPIRY_HOURS)
    }
  },
  CACHE: {
    VIETQR_TTL: env.int('CACHE_VIETQR_TTL', CACHE_VIETQR_TTL_SECONDS)
  },
  EMAIL: {
    SMTP_HOST: env.string('SMTP_HOST', 'smtp.gmail.com'),
    SMTP_PORT: env.int('SMTP_PORT', 587),
    SMTP_USER: env.string('SMTP_USER', ''),
    SMTP_PASSWORD: smtpPassword,
    SMTP_FROM_NOREPLY: env.string('SMTP_FROM_NOREPLY', 'no-reply@buddywallet.dpdns.org'),
    SMTP_FROM_SUPPORT: env.string('SMTP_FROM_SUPPORT', 'support@buddywallet.dpdns.org'),
    SMTP_POOL_SIZE: env.int('SMTP_POOL_SIZE', SMTP_POOL_SIZE)
  },
  IMPORT: {
    MAX_ROWS: env.int('IMPORT_MAX_ROWS', SHARED_CONSTANTS.IMPORT.MAX_ROWS),
    STALE_LOG_LIFETIME: env.int('IMPORT_STALE_LOG_LIFETIME', SHARED_CONSTANTS.IMPORT.STALE_LOG_LIFETIME),
    CHUNK_SIZE: env.int('IMPORT_CHUNK_SIZE', SHARED_CONSTANTS.IMPORT.CHUNK_SIZE)
  },
  STORAGE: {
    S3_ENDPOINT: env.string('S3_ENDPOINT', ''),
    S3_REGION: env.string('S3_REGION', ''),
    S3_BUCKET: env.string('S3_BUCKET', ''),
    S3_ACCESS_KEY_ID: env.string('S3_ACCESS_KEY_ID', ''),
    S3_SECRET_ACCESS_KEY: env.string('S3_SECRET_ACCESS_KEY', ''),
    S3_PUBLIC_BASE_URL: env.string('S3_PUBLIC_BASE_URL', ''),
    S3_FORCE_PATH_STYLE: env.bool('S3_FORCE_PATH_STYLE', true)
  },
  PAGINATION: {
    DEFAULT_LIMIT: env.int('PAGINATION_DEFAULT_LIMIT', SHARED_CONSTANTS.PAGINATION.DEFAULT_SIZE),
    MAX_LIMIT: env.int('PAGINATION_MAX_LIMIT', SHARED_CONSTANTS.PAGINATION.MAX_SIZE),
    MAX_OFFSET: env.int('PAGINATION_MAX_OFFSET', PAGINATION_MAX_OFFSET)
  },
  RATE_LIMITS: {
    STANDARD: { windowMs: RATE_LIMIT_WINDOW_1MIN, maxRequests: RATE_LIMIT_STANDARD_REQUESTS },
    STRICT: { windowMs: RATE_LIMIT_WINDOW_1MIN, maxRequests: RATE_LIMIT_STRICT_REQUESTS },

    // CRITICAL: Stricter auth limits to prevent brute-force attacks
    AUTH: { windowMs: RATE_LIMIT_WINDOW_1HOUR, maxRequests: RATE_LIMIT_LOGIN_REQUESTS },
    AUTH_SIGNUP: { windowMs: RATE_LIMIT_WINDOW_1HOUR, maxRequests: RATE_LIMIT_SIGNUP_REQUESTS },
    AUTH_RECOVERY: { windowMs: RATE_LIMIT_WINDOW_24HOUR, maxRequests: RATE_LIMIT_PASSWORD_RESET_REQUESTS },
    AUTH_RESET: { windowMs: RATE_LIMIT_WINDOW_24HOUR, maxRequests: RATE_LIMIT_PASSWORD_RESET_REQUESTS },
    AUTH_OTP: { windowMs: RATE_LIMIT_WINDOW_1HOUR, maxRequests: RATE_LIMIT_EMAIL_VERIFY_REQUESTS },

    BURST: { windowMs: RATE_LIMIT_WINDOW_10SEC, maxRequests: RATE_LIMIT_BURST_REQUESTS },
    UPLOAD: {
      windowMs: BACKEND_CONSTANTS.RATE_LIMITS.UPLOAD.windowMs,
      maxRequests: BACKEND_CONSTANTS.RATE_LIMITS.UPLOAD.requests
    },
    DOWNLOAD: { windowMs: RATE_LIMIT_WINDOW_1MIN, maxRequests: RATE_LIMIT_DOWNLOAD_REQUESTS },
    BROADCAST: { windowMs: RATE_LIMIT_WINDOW_1MIN, maxRequests: RATE_LIMIT_BROADCAST_REQUESTS },
    DELETE: { windowMs: RATE_LIMIT_WINDOW_1MIN, maxRequests: RATE_LIMIT_DELETE_REQUESTS }
  },
  PUSH: {
    VAPID_PUBLIC_KEY: env.string('VAPID_PUBLIC_KEY', ''),
    VAPID_PRIVATE_KEY: env.string('VAPID_PRIVATE_KEY', ''),
    VAPID_SUBJECT: env.string('VAPID_SUBJECT', 'mailto:example@yourdomain.com'),
    MAX_FAILED_ATTEMPTS: env.int('PUSH_MAX_FAILED_ATTEMPTS', 3)
  },
  SECURITY: {
    DEBT_CHECK_COUNT_TOKEN: env.string('DEBT_CHECK_COUNT_TOKEN', ''),
    TURNSTILE_SECRET: env.string('TURNSTILE_SECRET', '')
  }
} as const;

// Storage validation logging
if (configs.APP.IS_PRODUCTION && (!configs.STORAGE.S3_ENDPOINT || !configs.STORAGE.S3_BUCKET)) {
  logger.warn('S3 is not fully configured. Some features may be disabled.');
}

if (legacySmtpPassword && !env.string('SMTP_PASSWORD', '')) {
  logger.warn('SMTP_PASS is deprecated. Please use SMTP_PASSWORD instead.');
}
