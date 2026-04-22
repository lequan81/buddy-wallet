/**
 * Application Bootstrap
 *
 * Initializes DI container, Elysia app, middlewares, and routes.
 * This is the single source of truth for application configuration.
 */

import 'reflect-metadata';
import { Elysia } from 'elysia';
import { etag } from '@bogeychan/elysia-etag';
import { randomUUIDv7 } from 'bun';

// Config & Validation
import { configs, validateRuntimeEnv } from '@/config';
import { logger } from '@repo/logger';
import { GEN_ERRORS } from '@repo/errors';

// HTTP Middlewares
import {
  corsPlugin,
  csrfPlugin,
  requestLoggerPlugin,
  securityHeadersPlugin
} from '@/app/Http/Middlewares';

// Plugins & Infrastructure
import { actor } from '@/app/Providers/Plugins';
import { redisPlugin } from '@infra/Redis';

// Services & Routes
import { AppServiceProvider } from '@/app/Providers/AppServiceProvider';
import { registerApiRoutes } from '@/routes/api';
import { registerWebRoutes } from '@/routes/web';
import { telemetry } from '@infra/Telemetry';
import { apiError } from '@/lib/http';

/**
 * Bootstrap the Elysia application with all configurations
 */
export async function bootstrap(): Promise<Elysia> {
  // 1. Validate environment variables
  validateRuntimeEnv();

  // 2. Initialize Service Provider for Dependency Injection
  const appProvider = new AppServiceProvider();
  appProvider.register();
  appProvider.boot();

  // 3. Create and configure Elysia app
  const app = new Elysia()
    // --- LAYER 1: GLOBAL SECURITY & CACHING ---
    .use(etag()) 
    .use(corsPlugin) 
    .use(csrfPlugin) 
    .use(securityHeadersPlugin) 

    // --- LAYER 2: SYSTEM & WEB ROUTES ---
    .use(registerWebRoutes)

    // --- LAYER 3: INFRASTRUCTURE & OBSERVABILITY ---
    .derive(({ request }) => {
      const requestId = request.headers.get('X-Request-ID') || randomUUIDv7();
      return { requestId };
    })
    .onAfterHandle(({ requestId, set }) => {
      set.headers['X-Request-ID'] = requestId;
    })
    // Global error handler
    .onError(({ code, error, set }) => {
      logger.app('Global error caught', { code, error: String(error) });

      const errorByCode: Record<string, { status: number; error: { code: string; message: string } }> = {
        NOT_FOUND: { status: 404, error: GEN_ERRORS.NOT_FOUND },
        VALIDATION: { status: 400, error: GEN_ERRORS.VALIDATION },
        PARSE: { status: 400, error: GEN_ERRORS.INVALID_INPUT }
      };

      const mapped = errorByCode[code] ?? { status: 500, error: GEN_ERRORS.UNKNOWN };
      if (typeof set.status !== 'number' || set.status < 400) {
        set.status = mapped.status;
      }

      return apiError(mapped.error, (error as Error)?.message);
    })
    .use(telemetry ?? new Elysia())
    .use(redisPlugin)
    .use(requestLoggerPlugin)

    // --- LAYER 4: AUTHENTICATION ---
    .use(actor) 

    // --- LAYER 5: BUSINESS LOGIC & ROUTES ---
    .use(registerApiRoutes);

  return app;
}

/**
 * Start the application (called from main entry point)
 */
export async function start(): Promise<void> {
  const app = await bootstrap();

  app.listen(configs.APP.PORT, () => {
    logger.app(`API is running at http://${app.server?.hostname}:${app.server?.port}`);
  });
}

