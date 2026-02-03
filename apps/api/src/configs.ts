// Bun automatically loads .env files - no dotenv needed
import { validateSecretStrength } from '@repo/config';

export const getEnv = (key: string, defaultValue?: string): string => {
  // Bun.env là cách truy cập biến môi trường nhanh nhất trong Bun
  const value = Bun.env[key] || defaultValue;

  if (value === undefined) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
};

/**
 * Validate JWT secret strength using shared validation rules
 */
function validateJWTSecretOnStartup(secret: string): void {
  const validation = validateSecretStrength(secret);

  if (!validation.isValid && Bun.env.NODE_ENV === 'production') {
    throw new Error(`❌ JWT_SECRET security issues:\n  - ${validation.issues.join('\n  - ')}`);
  } else if (validation.issues.length > 0) {
    console.warn(`⚠️ JWT_SECRET security warnings:\n  - ${validation.issues.join('\n  - ')}`);
  }
}

const jwtSecret = getEnv('JWT_SECRET');
validateJWTSecretOnStartup(jwtSecret);

export const configs = {
  APP: {
    NODE_ENV: Bun.env.NODE_ENV || 'development',
    PORT: Bun.env.PORT || '3000',
    WEB_URL: getEnv('WEB_URL', 'http://localhost:5173'),
    IS_DEV: (Bun.env.NODE_ENV || 'development') !== 'production',
    IS_PROD: Bun.env.NODE_ENV === 'production'
  },
  AUTH: {
    JWT_SECRET: jwtSecret,
    ACCESS_TOKEN_LIFETIME: parseInt(Bun.env.ACCESS_TOKEN_LIFETIME || '900000'), // 15m default
    REFRESH_TOKEN_LIFETIME: parseInt(Bun.env.REFRESH_TOKEN_LIFETIME || '7776000000'), // 90d default
    JWT_BLACKLIST_SECONDS: parseInt(Bun.env.JWT_BLACKLIST_SECONDS || '900'), // 15m default
    MIN_PASSWORD_LENGTH: parseInt(Bun.env.MIN_PASSWORD_LENGTH || '8'),
    ARGON2_OPTIONS: {
      algorithm: 'argon2id' as const,
      memoryCost: parseInt(Bun.env.ARGON2_MEMORY_COST || '65536'), // 64MB
      timeCost: parseInt(Bun.env.ARGON2_TIME_COST || '3') // 3 iterations
    }
  },
  DEBT: {
    MIN_AMOUNT: parseInt(Bun.env.DEBT_MIN_AMOUNT || '1000'),
    MAX_AMOUNT: parseInt(Bun.env.DEBT_MAX_AMOUNT || '1000000000000') // 1T
  },
  IMPORT: {
    MAX_ROWS: parseInt(Bun.env.IMPORT_MAX_ROWS || '1000'),
    STALE_LOG_LIFETIME: parseInt(Bun.env.IMPORT_STALE_LOG_LIFETIME || '86400000') // 24h
  }
};
