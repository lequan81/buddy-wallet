// Bun automatically loads .env files - no dotenv needed
import { validateSecretStrength, optionalEnv, getEnvBool, getEnvInt } from '@repo/config';

/**
 * Validate JWT secret strength using shared validation rules
 */
function validateJWTSecretOnStartup(secret: string) {
  const validation = validateSecretStrength(secret);
  if (!validation.isValid && Bun.env.NODE_ENV === 'production') {
    throw new Error(`[ERROR] JWT_SECRET security issues:\n  - ${validation.issues.join('\n  - ')}`);
  } else if (validation.issues.length > 0) {
    console.warn(`[WARN] JWT_SECRET security warnings:\n  - ${validation.issues.join('\n  - ')}`);
  }
}

const jwtSecret = optionalEnv('JWT_SECRET', 'dev-secret-change-in-production');
validateJWTSecretOnStartup(jwtSecret);
const csrfSecret = optionalEnv('CSRF_SECRET', jwtSecret);
if (csrfSecret === jwtSecret) {
  console.warn('[WARN] CSRF_SECRET not set. Falling back to JWT_SECRET is allowed but not recommended.');
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const BURST_WINDOW_MS = 10 * 1000;

const nodeEnv = Bun.env.NODE_ENV || 'development';
const s3Endpoint = optionalEnv('S3_ENDPOINT', '');
const s3Region = optionalEnv('S3_REGION', '');
const s3Bucket = optionalEnv('S3_BUCKET', '');
const s3AccessKeyId = optionalEnv('S3_ACCESS_KEY_ID', '');
const s3SecretAccessKey = optionalEnv('S3_SECRET_ACCESS_KEY', '');
const s3PublicBaseUrl = optionalEnv('S3_PUBLIC_BASE_URL', '');
const s3ForcePathStyle = getEnvBool('S3_FORCE_PATH_STYLE', true);
const debtCheckCountToken = optionalEnv('DEBT_CHECK_COUNT_TOKEN', '');

const missingStorageEnv: string[] = [];
if (!s3Endpoint) missingStorageEnv.push('S3_ENDPOINT');
if (!s3Region) missingStorageEnv.push('S3_REGION');
if (!s3Bucket) missingStorageEnv.push('S3_BUCKET');
if (!s3AccessKeyId) missingStorageEnv.push('S3_ACCESS_KEY_ID');
if (!s3SecretAccessKey) missingStorageEnv.push('S3_SECRET_ACCESS_KEY');

if (missingStorageEnv.length > 0) {
  console.warn(`[WARN] S3 storage env warnings:\n  - ${missingStorageEnv.join('\n  - ')}`);
}

export const configs = {
  APP: {
    NODE_ENV: nodeEnv,
    PORT: optionalEnv('PORT', '3000'),
    WEB_URL: optionalEnv('WEB_URL', 'http://localhost:5173'),
    IS_DEV: nodeEnv !== 'production'
  },
  AUTH: {
    JWT_SECRET: jwtSecret,
    CSRF_SECRET: csrfSecret,
    ACCESS_TOKEN_LIFETIME: getEnvInt('ACCESS_TOKEN_LIFETIME', 900000),
    REFRESH_TOKEN_LIFETIME: getEnvInt('REFRESH_TOKEN_LIFETIME', 7776000000),
    JWT_BLACKLIST_SECONDS: getEnvInt('JWT_BLACKLIST_SECONDS', 900),
    MIN_PASSWORD_LENGTH: getEnvInt('MIN_PASSWORD_LENGTH', 8),
    ARGON2_OPTIONS: {
      algorithm: 'argon2id' as const,
      memoryCost: getEnvInt('ARGON2_MEMORY_COST', 65536),
      timeCost: getEnvInt('ARGON2_TIME_COST', 3)
    }
  },
  IMPORT: {
    MAX_ROWS: getEnvInt('IMPORT_MAX_ROWS', 1000),
    STALE_LOG_LIFETIME: getEnvInt('IMPORT_STALE_LOG_LIFETIME', 86400000)
  },
  PUSH: {
    VAPID_PUBLIC_KEY: optionalEnv('VAPID_PUBLIC_KEY', ''),
    VAPID_PRIVATE_KEY: optionalEnv('VAPID_PRIVATE_KEY', ''),
    VAPID_SUBJECT: optionalEnv('VAPID_SUBJECT', 'mailto:support@buddywallet.app'),
    MAX_FAILED_ATTEMPTS: getEnvInt('PUSH_MAX_FAILED_ATTEMPTS', 5)
  },
  STORAGE: {
    S3_ENDPOINT: s3Endpoint,
    S3_REGION: s3Region,
    S3_BUCKET: s3Bucket,
    S3_ACCESS_KEY_ID: s3AccessKeyId,
    S3_SECRET_ACCESS_KEY: s3SecretAccessKey,
    S3_PUBLIC_BASE_URL: s3PublicBaseUrl,
    S3_FORCE_PATH_STYLE: s3ForcePathStyle
  },
  SECURITY: {
    DEBT_CHECK_COUNT_TOKEN: debtCheckCountToken
  },
  PAGINATION: {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100
  },
  RATE_LIMITS: {
    STRICT: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: 5,
      message: 'Too many requests. Please wait before trying again.'
    },
    AUTH: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: 10,
      message: 'Too many authentication attempts. Please wait before trying again.'
    },
    AUTH_RECOVERY: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: getEnvInt('AUTH_RECOVERY_MAX_REQUESTS', 5),
      message: 'Too many password recovery attempts. Please wait before trying again.'
    },
    AUTH_RESET: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: getEnvInt('AUTH_RESET_MAX_REQUESTS', 5),
      message: 'Too many password reset attempts. Please wait before trying again.'
    },
    AUTH_OTP: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: getEnvInt('AUTH_OTP_MAX_REQUESTS', 5),
      message: 'Too many OTP requests. Please wait before trying again.'
    },
    STANDARD: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: 100,
      message: 'Rate limit exceeded. Please slow down.'
    },
    BURST: {
      windowMs: BURST_WINDOW_MS,
      maxRequests: 30,
      message: 'Too many requests in a short time. Please slow down.'
    },
    UPLOAD: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: 10,
      message: 'Upload limit exceeded. Please wait before uploading more files.'
    },
    DOWNLOAD: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: 100,
      message: 'Download limit exceeded. Please slow down.'
    },
    BROADCAST: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: 1,
      message: 'Broadcast limit exceeded. Maximum 1 broadcast per minute.'
    },
    DELETE: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: 20,
      message: 'Too many delete requests. Please slow down.'
    }
  }
};
