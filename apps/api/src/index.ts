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
  TracesController,
  PushController,
  BankController,
  UploadController,
  ProofController
} from './controllers';
import { telemetry } from './instrumentation';
import { logger } from '@repo/logger';
import { CleanupService } from './services/cleanup.service';
// Cleanup jobs now run externally via scripts/prune-worker AND internally via timers

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
            .use(ProofController)
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
  .use(TracesController);

// Only listen if run directly (not imported)
if (import.meta.main) {
  app.listen(configs.APP.PORT, () => {
    logger.app(`🦊 API is running at ${app.server?.hostname}:${app.server?.port}`);

    // Start background cleanup cron (every 15 minutes) with concurrency guard
    let cleanupRunning = false;
    setInterval(
      async () => {
        if (cleanupRunning) {
          logger.app('[CRON] Skipping cleanup - previous run still in progress');
          return;
        }
        cleanupRunning = true;
        try {
          logger.app('[CRON] Running background cleanup tasks...');
          await CleanupService.cleanupStaleProcessingLogs();
          await CleanupService.cleanupStalePendingLogs();
          await CleanupService.cleanupExpiredSessions();
          await CleanupService.cleanupExpiredOTPs();
          logger.app('[CRON] Cleanup complete');
        } catch (err) {
          logger.error('[CRON] Cleanup error:', { error: String(err) });
        } finally {
          cleanupRunning = false;
        }
      },
      15 * 60 * 1000
    );
  });
}

export type App = typeof app;
