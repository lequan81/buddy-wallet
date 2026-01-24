import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { configs } from '../configs';

/**
 * 2. CORS Plugin
 * Cấu hình chi tiết Secret và Schema
 */
export const corsPlugin = new Elysia({ name: 'CORS_Plugin' })
  .use(
    cors({
      origin: configs.WEB_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  )
  .derive(async ({ cookie: { session } }) => {
    // Debug logging
    console.error(`[CORS-PLUGIN] Checking auth. Session: ${!!(session && session.value)}`);

    return { cors: true };
  });
