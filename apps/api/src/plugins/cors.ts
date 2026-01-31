import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { configs } from '@/configs';
import { logger } from '@utils/logger';

/**
 * 2. CORS Plugin
 * Cấu hình chi tiết Secret và Schema
 */
logger.cors(`Initialized with origins: ${configs.APP.WEB_URL}`);

export const corsPlugin = new Elysia({ name: 'CORS_Plugin' })
  .use(
    cors({
      origin: configs.APP.WEB_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  )
  .derive(async () => {
    return { cors: true };
  });
