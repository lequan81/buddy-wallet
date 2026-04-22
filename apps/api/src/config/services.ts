import { env, SHARED_CONSTANTS, BACKEND_CONSTANTS } from '@repo/config';

const smtpPassword = env.string('SMTP_PASSWORD', env.string('SMTP_PASS', ''));

export const servicesConfig = {
  EMAIL: {
    SMTP_HOST: env.string('SMTP_HOST', 'smtp.gmail.com'),
    SMTP_PORT: env.int('SMTP_PORT', 587),
    SMTP_USER: env.string('SMTP_USER', ''),
    SMTP_PASSWORD: smtpPassword,
    SMTP_FROM_NOREPLY: env.string('SMTP_FROM_NOREPLY', 'no-reply@buddywallet.dpdns.org'),
    SMTP_FROM_SUPPORT: env.string('SMTP_FROM_SUPPORT', 'support@buddywallet.dpdns.org'),
    SMTP_POOL_SIZE: env.int('SMTP_POOL_SIZE', 5)
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
  PUSH: {
    VAPID_PUBLIC_KEY: env.string('VAPID_PUBLIC_KEY', ''),
    VAPID_PRIVATE_KEY: env.string('VAPID_PRIVATE_KEY', ''),
    VAPID_SUBJECT: env.string('VAPID_SUBJECT', 'mailto:example@yourdomain.com'),
    MAX_FAILED_ATTEMPTS: env.int('PUSH_MAX_FAILED_ATTEMPTS', 3)
  },
  SECURITY: {
    DEBT_CHECK_COUNT_TOKEN: env.string('DEBT_CHECK_COUNT_TOKEN', ''),
    TURNSTILE_SECRET: env.string('TURNSTILE_SECRET', '')
  },
  RATE_LIMITS: {
    STANDARD: { windowMs: 60000, maxRequests: 100 },
    STRICT: { windowMs: 60000, maxRequests: 5 },
    AUTH: { windowMs: 3600000, maxRequests: 20 },
    AUTH_SIGNUP: { windowMs: 3600000, maxRequests: 10 },
    AUTH_RECOVERY: { windowMs: 86400000, maxRequests: 5 },
    AUTH_RESET: { windowMs: 86400000, maxRequests: 5 },
    AUTH_OTP: { windowMs: 3600000, maxRequests: 6 },
    BURST: { windowMs: 10000, maxRequests: 30 },
    UPLOAD: {
      windowMs: BACKEND_CONSTANTS.RATE_LIMITS.UPLOAD.windowMs,
      maxRequests: BACKEND_CONSTANTS.RATE_LIMITS.UPLOAD.requests
    },
    DOWNLOAD: { windowMs: 60000, maxRequests: 100 },
    BROADCAST: { windowMs: 60000, maxRequests: 1 },
    DELETE: { windowMs: 60000, maxRequests: 20 }
  }
};

