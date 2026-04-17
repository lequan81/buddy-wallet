import 'reflect-metadata';
import { Elysia } from 'elysia';
import { etag } from '@bogeychan/elysia-etag';
import { container } from 'tsyringe';
import { logger } from '@repo/logger';
import { GEN_ERRORS, apiResponse } from '@repo/errors';
import {
  corsPlugin,
  csrfPlugin,
  securityHeadersPlugin,
  redisPlugin,
  requestLoggerPlugin
} from '@/plugins';
import { AppServiceProvider } from './app/Providers/AppServiceProvider';
import { configs } from './config';

/**
 * Application Bootstrap
 * Initializes DI container, Elysia app, and global middlewares.
 */
export async function bootstrap(): Promise<Elysia> {
  // 1. Initialize Service Providers
  const appProvider = new AppServiceProvider();
  appProvider.register();
  appProvider.boot();

  // 2. Create Elysia Instance
  const app = new Elysia()
    // --- 1. GLOBAL SECURITY & CACHING ---
    .use(etag())
    .use(corsPlugin)
    .use(csrfPlugin)
    .use(securityHeadersPlugin)

    // --- 2. GLOBAL UTILS ---
    .use(redisPlugin)
    .use(requestLoggerPlugin)

    // --- 3. ERROR HANDLING ---
    .onError(({ code, error, set }) => {
      logger.app('Global error caught', { code, error: String(error) });

      const errorByCode: Record<
        string,
        { status: number; error: { code: string; message: string } }
      > = {
        NOT_FOUND: { status: 404, error: GEN_ERRORS.NOT_FOUND },
        VALIDATION: { status: 400, error: GEN_ERRORS.VALIDATION },
        PARSE: { status: 400, error: GEN_ERRORS.INVALID_INPUT }
      };

      const mapped = errorByCode[code] ?? { status: 500, error: GEN_ERRORS.UNKNOWN };
      if (typeof set.status !== 'number' || set.status < 400) {
        set.status = mapped.status;
      }

      return apiResponse({
        ok: false,
        error: mapped.error,
        details: (error as Error)?.message
      });
    });

  return app;
}
