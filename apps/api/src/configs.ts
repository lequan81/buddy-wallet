import { 
  BACKEND_CONSTANTS, 
  validateSecretStrength, 
  optionalEnv, 
  getEnvBool, 
  getEnvInt,
  SHARED_CONSTANTS
} from '@repo/config';

/**
 * Startup Validation - Ensures environment is ready
 */
const nodeEnv = Bun.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

// Validation helper
function validateEnv() {
  const jwtSecret = Bun.env.JWT_SECRET;
  if (!jwtSecret && isProd) {
    throw new Error('[ERROR] JWT_SECRET is required in production');
  } else if (!jwtSecret) {
    console.warn('[WARN] JWT_SECRET not set. Using insecure default.');
  } else {
    const validation = validateSecretStrength(jwtSecret);
    if (!validation.isValid) {
      if (isProd) throw new Error(`[ERROR] JWT_SECRET security issues:\n  - ${validation.issues.join('\n  - ')}`);
      console.warn(`[WARN] JWT_SECRET security issues:\n  - ${validation.issues.join('\n  - ')}`);
    }
  }

  if (!Bun.env.DATABASE_URL && isProd) {
    throw new Error('[ERROR] DATABASE_URL is required in production');
  }
}

// Run validation immediately on import
validateEnv();

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
    IS_DEV: !isProd
  },
  AUTH: {
    JWT_SECRET: optionalEnv('JWT_SECRET', 'dev-secret-change-in-production'),
    CSRF_SECRET: optionalEnv('CSRF_SECRET', optionalEnv('JWT_SECRET', '')),
    ACCESS_TOKEN_LIFETIME: getEnvInt('ACCESS_TOKEN_LIFETIME', 900000),
    REFRESH_TOKEN_LIFETIME: getEnvInt('REFRESH_TOKEN_LIFETIME', 7776000000),
    PASSWORD_MIN_LENGTH: getEnvInt('MIN_PASSWORD_LENGTH', SHARED_CONSTANTS.USER.PASSWORD_MIN_LENGTH),
    ARGON2: {
      memoryCost: getEnvInt('ARGON2_MEMORY_COST', 65536),
      timeCost: getEnvInt('ARGON2_TIME_COST', 3)
    }
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
    S3_FORCE_PATH_STYLE: getEnvBool('S3_FORCE_PATH_STYLE', true)
  },
  PAGINATION: {
    DEFAULT_LIMIT: getEnvInt('PAGINATION_DEFAULT_LIMIT', SHARED_CONSTANTS.PAGINATION.DEFAULT_SIZE),
    MAX_LIMIT: getEnvInt('PAGINATION_MAX_LIMIT', SHARED_CONSTANTS.PAGINATION.MAX_SIZE)
  },
  RATE_LIMITS: {
    STANDARD: { windowMs: 60000, maxRequests: 100 },
    STRICT: { windowMs: 60000, maxRequests: 5 },
    AUTH: { windowMs: 60000, maxRequests: 10 },
    UPLOAD: { 
      windowMs: BACKEND_CONSTANTS.RATE_LIMITS.UPLOAD.windowMs, 
      maxRequests: BACKEND_CONSTANTS.RATE_LIMITS.UPLOAD.requests 
    }
  }
} as const;

// Storage validation logging
if (isProd && (!configs.STORAGE.S3_ENDPOINT || !configs.STORAGE.S3_BUCKET)) {
  console.warn('[STORAGE] S3 is not fully configured. Some features may be disabled.');
}
