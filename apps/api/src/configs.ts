import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from apps/api root
config({ path: resolve(import.meta.dir, '..', '.env') });

export const getEnv = (key: string, defaultValue?: string): string => {
  // Bun.env là cách truy cập biến môi trường nhanh nhất trong Bun
  const value = Bun.env[key] || defaultValue;

  if (value === undefined) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
};

/**
 * Validate JWT secret strength
 */
function validateJWTSecret(secret: string): void {
  const issues: string[] = [];

  if (secret.length < 32) {
    issues.push('JWT_SECRET must be at least 32 characters long');
  }

  // Check for common weak secrets
  const weakPatterns = ['secret', 'password', 'jwt_secret', 'your-secret', 'changeme', '123456'];
  if (weakPatterns.some((weak) => secret.toLowerCase().includes(weak))) {
    issues.push('JWT_SECRET contains weak patterns (secret, password, etc.)');
  }

  // Check entropy (character variety)
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < 10) {
    issues.push('JWT_SECRET has low character variety (use more unique characters)');
  }

  if (issues.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`❌ JWT_SECRET security issues:\n  - ${issues.join('\n  - ')}`);
  } else if (issues.length > 0) {
    console.warn(`⚠️ JWT_SECRET security warnings:\n  - ${issues.join('\n  - ')}`);
  }
}

const jwtSecret = getEnv('JWT_SECRET');
validateJWTSecret(jwtSecret);

export const configs = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '3000',
  JWT_SECRET: jwtSecret,
  WEB_URL: getEnv('WEB_URL', 'http://localhost:5173')
};
