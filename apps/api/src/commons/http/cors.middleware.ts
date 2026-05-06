import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { configs } from '@/config';
import { logger } from '@repo/logger';

/**
 * 2. CORS Plugin
 * Cấu hình chi tiết Secret và Schema
 */

const parseAllowedOrigins = (raw: string): string[] =>
  raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const configuredWebUrl = (configs.APP.WEB_URL || '').trim();
const allowedOrigins = parseAllowedOrigins(configuredWebUrl);

if (allowedOrigins.length === 0) {
  logger.error('FATAL: WEB_URL is empty. Configure at least one allowed origin.');
  throw new Error('WEB_URL must contain at least one allowed origin');
}

if (configs.APP.IS_PRODUCTION && allowedOrigins.some((origin) => origin.includes('localhost'))) {
  logger.error('FATAL: localhost origin is not allowed in production');
  throw new Error('WEB_URL must not include localhost in production');
}

logger.cors(`Initialized with origins: ${allowedOrigins.join(', ')}`);

export const corsPlugin = new Elysia({ name: 'CORS_Plugin' })
  .use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
    })
  )
  .derive(async () => {
    return { cors: true };
  });

