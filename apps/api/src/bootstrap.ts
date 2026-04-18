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
import { container } from 'tsyringe';

// Config & Validation
import { configs, validateRuntimeEnv } from '@/configs';
import { logger } from '@repo/logger';
import { GEN_ERRORS, apiResponse } from '@repo/errors';

// HTTP Middlewares (per app/Http/Middlewares structure)
import {
  corsPlugin,
  csrfPlugin,
  requestLoggerPlugin,
  securityHeadersPlugin
} from '@/app/Http/Middlewares';

// Auth and DI Plugins
import {
  sessionAuthPlugin,
  redisPlugin
} from '@/lib/plugins';

// Application
import { AppServiceProvider } from '@/app/Providers/AppServiceProvider';
import { registerApiRoutes } from '@/routes/api';
import { telemetry } from '@/instrumentation';
import { getStorageReadiness } from '@/lib/health';
import { requireAuth } from '@/lib/http';

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
    // --- LAYER 1: GLOBAL SECURITY & CACHING (Outermost) ---
    .use(etag()) // Global ETags to save bandwidth (304 Not Modified)
    .use(corsPlugin) // Reject unauthorized origins early
    .use(csrfPlugin) // Prevent CSRF attacks globally
    .use(securityHeadersPlugin) // HSTS, CSP, X-Frame-Options

    // --- LAYER 2: FAST-EXIT HEALTH CHECKS (Minimal overhead) ---
    .get('/health', () =>
      apiResponse({
        ok: true,
        data: {
          status: 'ok',
          version: '1.2.4',
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }
      })
    )
    .get('/health/ready', async ({ set }) => {
      const storage = await getStorageReadiness();
      if (!storage.ready) {
        set.status = 503;
        return apiResponse({
          ok: false,
          error: GEN_ERRORS.NETWORK,
          details: `Storage degraded: ${JSON.stringify(storage)}`
        });
      }

      return apiResponse({
        ok: true,
        data: {
          status: 'ready',
          storage,
          timestamp: new Date().toISOString()
        }
      });
    })

    // --- LAYER 3: INFRASTRUCTURE & OBSERVABILITY ---
    .derive(({ request }) => {
      const requestId = request.headers.get('X-Request-ID') || randomUUIDv7();
      return { requestId };
    })
    .onAfterHandle(({ requestId, set }) => {
      set.headers['X-Request-ID'] = requestId;
    })
    // Global error handler (catches all unhandled errors)
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

      return apiResponse({
        ok: false,
        error: mapped.error,
        details: (error as Error)?.message
      });
    })
    .use(telemetry ?? new Elysia())
    .use(redisPlugin)
    .use(requestLoggerPlugin)

    // --- LAYER 4: AUTHENTICATION ---
    .use(sessionAuthPlugin) // Session-based auth (optional)

    // --- LAYER 5: BUSINESS LOGIC & ROUTES ---
    .use((app) => registerApiRoutes(app))

    // --- LAYER 6: DEFAULT ROUTE ---
    .get('/', () =>
      apiResponse({
        ok: true,
        data: {
          name: 'Buddy Wallet API',
          version: '1.2.4',
          status: 'running',
          docs: '/health'
        }
      })
    );

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
