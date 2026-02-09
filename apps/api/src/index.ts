import { Elysia } from 'elysia';
import { configs } from '@/configs'; // Ensure env is loaded first
import {
  corsPlugin,
  csrfPlugin,
  sessionAuthPlugin,
  permissionPlugin,
  requestLoggerPlugin,
  redisPlugin,
  securityHeadersPlugin
} from '@plugins';
import {
  activityController,
  authController,
  debtsController,
  exportController,
  importController,
  publicController,
  usersController,
  tracesController,
  pushController,
  bankController,
  uploadController
} from '@controllers';
import { telemetry } from './instrumentation';
import { logger } from './utils/logger';
// Cleanup jobs now run externally via scripts/prune-worker

export const app = new Elysia()
  // Global error handler - ensures all errors return proper JSON
  .onError(({ code, error, set }) => {
    logger.app('Global error caught', { code, error: String(error) });
    
    // Default to 500 for unknown errors
    if (!set.status || set.status < 400) {
      set.status = code === 'NOT_FOUND' ? 404 : 
                   code === 'VALIDATION' ? 400 : 
                   code === 'PARSE' ? 400 : 500;
    }
    
    return {
      success: false,
      error: code,
      message: error?.message || 'Internal server error'
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
      .use(authController)
      .use(publicController) // /v1/check-debt
      .use(pushController) // Push notifications (vapid-key is public, others check user internally)
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
            .use(usersController)
            .use(debtsController)
            .use(importController)
            .use(exportController)
            .use(activityController)
            .use(bankController)
            .use(uploadController) // File uploads for QR codes and payment proofs
      )
  )
  .get('/health', () => ({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.2.4',
    memory: process.memoryUsage().heapUsed
  }))
  // Trace viewer (dev only)
  .use(tracesController);

if (import.meta.main) {
  app.listen(configs.APP.PORT);

  logger.app(`Server started`, {
    host: app.server?.hostname,
    port: app.server?.port,
    environment: Bun.env.NODE_ENV || 'development'
  });
}

export type App = typeof app;
