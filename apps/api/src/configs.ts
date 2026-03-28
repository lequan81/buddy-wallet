// Bun automatically loads .env files - no dotenv needed
import { validateSecretStrength, optionalEnv, getEnvInt } from '@repo/config';

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

export const configs = {
  APP: {
    NODE_ENV: Bun.env.NODE_ENV || 'development',
    PORT: optionalEnv('PORT', '3000'),
    WEB_URL: optionalEnv('WEB_URL', 'http://localhost:5173'),
    IS_DEV: (Bun.env.NODE_ENV || 'development') !== 'production'
  },
  AUTH: {
    JWT_SECRET: jwtSecret,
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
  PAGINATION: {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100,
  },
  RATE_LIMITS: {
    STRICT: {
      windowMs: 60 * 1000,
      maxRequests: 5,
      message: 'Too many requests. Please wait before trying again.'
    },
    AUTH: {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: 'Too many authentication attempts. Please wait before trying again.'
    },
    STANDARD: {
      windowMs: 60 * 1000,
      maxRequests: 100,
      message: 'Rate limit exceeded. Please slow down.'
    },
    BURST: {
      windowMs: 10 * 1000,
      maxRequests: 30,
      message: 'Too many requests in a short time. Please slow down.'
    },
    UPLOAD: {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: 'Upload limit exceeded. Please wait before uploading more files.'
    },
    DOWNLOAD: {
      windowMs: 1000 * 60,
      maxRequests: 100,
      message: 'Download limit exceeded. Please slow down.'
    },
    BROADCAST: {
      windowMs: 60 * 1000,
      maxRequests: 1,
      message: 'Broadcast limit exceeded. Maximum 1 broadcast per minute.'
    },
    DELETE: {
      windowMs: 60 * 1000,
      maxRequests: 20,
      message: 'Too many delete requests. Please slow down.'
    }
  }
};
