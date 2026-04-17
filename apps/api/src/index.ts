import { Elysia } from 'elysia';
import { etag } from '@bogeychan/elysia-etag';
import { container } from 'tsyringe';
import { configs, validateRuntimeEnv } from './configs';
import {
  corsPlugin,
  csrfPlugin,
  sessionAuthPlugin,
  requestLoggerPlugin,
  redisPlugin,
  securityHeadersPlugin
} from './plugins';

// New Architecture Controllers (app/Http/Controllers)
// Instance-based controllers (plain Elysia instances)
import {
  ActivityController,
  TracesController
} from '@/app/Http/Controllers';

// Class-based controllers (DI with @injectable)
import {
  AuthController,
  DebtController,
  ExportController,
  ImportController,
  PublicController,
  UserController,
  PushController,
  BankController,
  StorageController
} from '@/app/Http/Controllers';

// Initialize DI Container
import { AppServiceProvider } from '@/app/Providers/AppServiceProvider';

import { telemetry } from './instrumentation';
import { logger } from '@repo/logger';
import { GEN_ERRORS, apiResponse } from '@repo/errors';
import { requireAuth } from '@/core/http/require-auth';
import { getStorageReadiness } from '@/core/health/storage-readiness';
import { randomUUIDv7 } from 'bun';

// Validate environment variables on startup
validateRuntimeEnv();

// Initialize Service Provider for DI
const appProvider = new AppServiceProvider();
appProvider.register();
appProvider.boot();

// Initialize class-based controllers via DI container
const AuthControllerInstance = container.resolve(AuthController).register(new Elysia());
const DebtsControllerInstance = container.resolve(DebtController).register(new Elysia());
const ExportControllerInstance = container.resolve(ExportController).register(new Elysia());
const ImportControllerInstance = container.resolve(ImportController).register(new Elysia());
const PublicControllerInstance = container.resolve(PublicController).register(new Elysia());
const UsersControllerInstance = container.resolve(UserController).register(new Elysia());
const PushControllerInstance = container.resolve(PushController).register(new Elysia());
const BankControllerInstance = container.resolve(BankController).register(new Elysia());
const UploadControllerInstance = container.resolve(StorageController).register(new Elysia());

// Instance-based controllers are used directly
const ActivityControllerInstance = ActivityController;
const TracesControllerInstance = TracesController;

/**
 * Main API Application Instance
 * Reorganized for "Production-Grade" performance and security:
 * 1. Global Security/Caching (Outermost layer)
 * 2. Health Checks (Fast-exit for infrastructure pings)
 * 3. Infrastructure (Telemetry, Logger, Redis)
 * 4. Business Logic (Controllers)
 */
export const app = new Elysia()
  // --- 1. GLOBAL SECURITY & CACHING (The Outermost Onion Layers) ---
  .use(etag())               // Global ETags to save bandwidth (304 Not Modified)
  .use(corsPlugin)           // Reject unauthorized origins early
  .use(csrfPlugin)           // Prevent CSRF attacks globally
  .use(securityHeadersPlugin)// HSTS, CSP, X-Frame-Options for all responses

  // --- 2. FAST-EXIT ENDPOINTS (No heavy middleware needed) ---
  .get('/health', () => apiResponse({
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

  // --- 3. INFRASTRUCTURE & OBSERVABILITY (Legitimate traffic starts here) ---
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

    return apiResponse({
      ok: false,
      error: mapped.error,
      details: (error as Error)?.message
    });
  })
  .use(telemetry ?? new Elysia())
  .use(redisPlugin)
  .use(requestLoggerPlugin)
  .use(TracesControllerInstance)

  // --- 4. BUSINESS LOGIC (Core API v1) ---
  .group('/v1', (app) =>
    app
      // Session-based authentication (sets user if valid token exists)
      .use(sessionAuthPlugin)
      // Auth routes (login/register work without user, /me/logout need user)
      .use(AuthControllerInstance)
      .use(PublicControllerInstance) // /v1/check-debt
      .use(PushControllerInstance) // Push notifications
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
            .use(UsersControllerInstance)
            .use(DebtsControllerInstance)
            .use(ImportControllerInstance)
            .use(ExportControllerInstance)
            .use(ActivityControllerInstance)
            .use(BankControllerInstance)
            .use(UploadControllerInstance)
      )
  )

  // --- 5. DEFAULT ROUTE ---
  .get('/', () => apiResponse({
    ok: true,
    data: {
      name: 'Buddy Wallet API',
      version: '1.2.4',
      status: 'running',
      docs: '/health'
    }
  }));

// Only listen if run directly
if (import.meta.main) {
  app.listen(configs.APP.PORT, () => {
    logger.app(`API is running at ${app.server?.hostname}:${app.server?.port}`);
  });
}

export type App = typeof app;
