import { Elysia } from 'elysia';
import { configs, validateRuntimeEnv } from './configs';
import {
  corsPlugin,
  csrfPlugin,
  sessionAuthPlugin,
  requestLoggerPlugin,
  redisPlugin,
  securityHeadersPlugin
} from './plugins';
import {
  ActivityController,
  AuthController,
  DebtsController,
  ExportController,
  ImportController,
  PublicController,
  TracesController,
  UsersController,
  PushController,
  BankController,
  UploadController
} from './controllers';
import { telemetry } from './instrumentation';
import { logger } from '@repo/logger';
import { GEN_ERRORS, apiResponse } from '@repo/errors';
import { requireAuth } from '@/core/http/require-auth';
import { getStorageReadiness } from '@/core/health/storage-readiness';
import { randomUUIDv7 } from 'bun';

// Validate environment variables on startup
validateRuntimeEnv();

export const app = new Elysia()
  // Global Request ID
  .derive(({ request }) => {
    const requestId = request.headers.get('X-Request-ID') || randomUUIDv7();
    return { requestId };
  })
  .onAfterHandle(({ requestId, set }) => {
    set.headers['X-Request-ID'] = requestId;
  })
  // Global error handler - ensures all errors return proper JSON
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
  // OpenTelemetry (if enabled)
  .use(telemetry ?? new Elysia())
  // Redis (if enabled)
  .use(redisPlugin)
  // Request logging
  .use(requestLoggerPlugin)
  // Security headers (CSP, X-Frame-Options, etc.)
  .use(securityHeadersPlugin)
  .use(TracesController)
  .use(corsPlugin)
  .use(csrfPlugin) // Global CSRF Protection
  .group('/v1', (app) =>
    app
      // Session-based authentication (sets user if valid token exists)
      .use(sessionAuthPlugin)
      // Auth routes (login/register work without user, /me/logout need user)
      .use(AuthController)
      .use(PublicController) // /v1/check-debt
      .use(PushController) // Push notifications
      // Guarded Routes (Require Authentication for the entire group)
      .guard(
        {
          beforeHandle: (ctx) => {
            const auth = requireAuth(
              (ctx as { user?: import('@repo/db').User | null }).user,
              ctx.set
            );
            if ('error' in auth) {
              return auth.error;
            }
          }
        },
        (app) =>
          app
            .use(UsersController)
            .use(DebtsController)
            .use(ImportController)
            .use(ExportController)
            .use(ActivityController)
            .use(BankController)
            .use(UploadController)
      )
  )
  .get('/', () => apiResponse({
    ok: true,
    data: {
      name: 'Buddy Wallet API',
      version: '1.2.4',
      status: 'running',
      docs: '/health'
    }
  }))
  .get('/health', async () => apiResponse({
    ok: true,
    data: {
      status: 'ok',
      version: '1.2.4',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  }))
  .get('/health/ready', async ({ set }) => {
    const storage = await getStorageReadiness();
    if (!storage.ready) {
      set.status = 503;
      return apiResponse({
        ok: false,
        error: GEN_ERRORS.NETWORK,
        data: {
          status: 'degraded',
          storage,
          timestamp: new Date().toISOString()
        }
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
  });

// Only listen if run directly
if (import.meta.main) {
  app.listen(configs.APP.PORT, () => {
    logger.app(`API is running at ${app.server?.hostname}:${app.server?.port}`);
  });
}

export type App = typeof app;
