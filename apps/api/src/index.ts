import { Elysia } from 'elysia';
import { configs } from './configs'; // Ensure env is loaded first
import {
  corsPlugin,
  csrfPlugin,
  sessionAuthPlugin,
  permissionPlugin,
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
  UsersController,
  TracesController,
  PushController,
  BankController,
  UploadController
} from './controllers';
import { telemetry } from './instrumentation';
import { logger } from './utils/logger';
// Cleanup jobs now run externally via scripts/prune-worker

export const app = new Elysia()
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { user, set } = ctx as any;
            if (!user) {
              set.status = 401;
              return { success: false, message: 'Unauthorized' };
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
  // Trace viewer (dev only)
  .use(TracesController)
  .onError(({ code, error, set }) => {
    console.error(`Global error caught`, { code, error });
    set.status = 500;
    return {
      success: false,
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : String(error)
    };
  });

// Only listen if run directly (not imported)
if (import.meta.main) {
  app.listen(configs.APP.PORT, () => {
    console.log(`🦊 API is running at ${app.server?.hostname}:${app.server?.port}`);
  });
}

export type App = typeof app;
