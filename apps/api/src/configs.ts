import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from apps/api root
config({ path: resolve(import.meta.dir, '..', '.env') });

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const configs = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '3000',
  JWT_SECRET: getEnv('JWT_SECRET'),
  WEB_URL: getEnv('WEB_URL', 'http://localhost:5173')
  // DATABASE_URL is managed by @repo/db but good to have here if needed,
  // though typically @repo/db handles its own connection.
  // We'll leave it out to avoid confusion unless explicitly needed by API.
};
