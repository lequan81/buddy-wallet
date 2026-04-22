import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { configs } from '@/config';
import { logger } from '@repo/logger';

/**
 * 2. CORS Plugin
 * Cấu hình chi tiết Secret và Schema
 */

// SECURITY: Fail fast in production if WEB_URL not configured
if (configs.APP.NODE_ENV === 'production' && !configs.APP.WEB_URL) {
  logger.error('FATAL: WEB_URL not set in production environment');
  throw new Error('WEB_URL environment variable is required in production');
}

const allowedOrigin = configs.APP.WEB_URL || 'http://localhost:5173';
logger.cors(`Initialized with origins: ${allowedOrigin}`);

export const corsPlugin = new Elysia({ name: 'CORS_Plugin' })
  .use(
    cors({
      origin: allowedOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
    })
  )
  .derive(async () => {
    return { cors: true };
  });

