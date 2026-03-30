import { Elysia } from 'elysia';
import { configs } from './configs'; // Ensure env is loaded first
import {
  corsPlugin,
  csrfPlugin,
  sessionAuthPlugin,
  permissionPlugin,
  requestLoggerPlugin,
  redisPlugin,
  securityHeadersPlugin,
  servicesPlugin
} from './plugins';
import {
  ActivityController,
  AuthController,
  DebtsController,
  ExportController,
  ImportController,
  PublicController,
  UsersController,
  PushController,
  BankController,
  UploadController
} from './controllers';
import { telemetry } from './instrumentation';
import { logger } from '@repo/logger';
import { requireAuth } from '@/core/http/require-auth';
import { getStorageReadiness } from '@/core/health/storage-readiness';
import { randomUUIDv7 } from 'bun';

// Cleanup jobs run via external worker/timer entrypoint.

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

    // Default to 500 for unknown errors
    const statusCode = typeof set.status === 'number' ? set.status : 500;
    if (!set.status || statusCode < 400) {
      set.status =
        code === 'NOT_FOUND' ? 404 : code === 'VALIDATION' ? 400 : code === 'PARSE' ? 400 : 500;
    }

    return {
      success: false,
      error: code,
      message: (error as Error)?.message || 'Internal server error'
    };
  })
  // OpenTelemetry (if enabled)
  .use(telemetry ?? new Elysia())
  // Services DI (decorate context with all services)
  .use(servicesPlugin)
  // Redis (if enabled)
  .use(redisPlugin)
  // Request logging
  .use(requestLoggerPlugin)
  // Security headers (CSP, X-Frame-Options, etc.)
  .use(securityHeadersPlugin)
  .use(corsPlugin)
  .use(csrfPlugin) // Global CSRF Protection
  .group('/v1', (app) =>
    app
      // Session-based authentication (sets user if valid token exists)
      .use(sessionAuthPlugin)
      // Auth routes (login/register work without user, /me/logout need user)
      .use(AuthController)
      .use(PublicController) // /v1/check-debt
      .use(PushController) // Push notifications (vapid-key is public, others check user internally)
      .use(permissionPlugin)
      // Guarded Routes (Require Authentication)
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
            .use(UploadController) // File uploads for QR codes and payment proofs
      )
  )
  .get('/', () => ({
    name: 'Buddy Wallet API',
    version: '1.2.4',
    status: 'running',
    docs: '/health'
  }))
  .get('/health', async () => {
    // Basic health check
    const base = {
      status: 'ok',
      version: '1.2.4',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
    return base;
  })
  .get('/health/ready', async ({ set }) => {
    const storage = await getStorageReadiness();
    if (!storage.ready) {
      set.status = 503;
      return {
        status: 'degraded',
        storage,
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 'ready',
      storage,
      timestamp: new Date().toISOString()
    };
  });

// Only listen if run directly (not imported)
if (import.meta.main) {
  app.listen(configs.APP.PORT, () => {
    logger.app(`API is running at ${app.server?.hostname}:${app.server?.port}`);
  });
}

export type App = typeof app;
