import { Elysia } from 'elysia';
import { configs } from '@/configs'; // Ensure env is loaded first
import { corsPlugin, csrfPlugin, sessionAuthPlugin, permissionPlugin, requestLoggerPlugin } from '@plugins';
import {
  authController,
  debtsController,
  exportController,
  importController,
  publicController,
  usersController,
  tracesController
} from '@controllers';
import { telemetry } from './instrumentation';
import { logger } from './utils/logger';

const app = new Elysia()
  // OpenTelemetry (if enabled)
  .use(telemetry ?? new Elysia())
  // Request logging
  .use(requestLoggerPlugin)
  .use(corsPlugin)
  .use(csrfPlugin) // Global CSRF Protection
  .group('/v1', (app) =>
    app
      // Session-based authentication (sets user if valid token exists)
      .use(sessionAuthPlugin)
      // Auth routes (login/register work without user, /me/logout need user)
      .use(authController)
      .use(publicController) // /v1/check-debt
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
          app.use(usersController).use(debtsController).use(importController).use(exportController)
      )
  )
  .get('/health', () => ({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.2.4',
    memory: process.memoryUsage().heapUsed
  }))
  // Trace viewer (dev only)
  .use(tracesController)
  .listen(configs.PORT);

logger.app(`Server started`, {
  host: app.server?.hostname,
  port: app.server?.port,
  environment: Bun.env.NODE_ENV || 'development',
});

export type App = typeof app;
