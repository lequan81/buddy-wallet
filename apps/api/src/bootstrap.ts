/**
 * Application Bootstrap
 *
 * Initializes Elysia app, middlewares, and routes.
 * This is the single source of truth for application configuration.
 * Following ElysiaJS functional programming - no DI container.
 */

import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { etag } from '@bogeychan/elysia-etag';
import { randomUUIDv7 } from 'bun';

// Config & Validation
import { configs, validateRuntimeEnv } from '@/config';
import { logger } from '@repo/logger';
import { GEN_ERRORS } from '@repo/errors';

// Global plugins
import {
  corsPlugin,
  csrfPlugin,
  securityHeadersPlugin,
  requestLoggerPlugin,
  redisPlugin,
  telemetry,
  actor
} from '@/plugins';
import { apiError } from '@/commons/http/response';

// Business Logic Modules
import { authHandler } from '@/modules/auth';
import { debtsHandler } from '@/modules/debts';
import { bankHandler } from '@/modules/bank';
import { storageHandler } from '@/modules/storage';
import { userHandler } from '@/modules/user';
import { dataHandler } from '@/modules/data';
import { notificationHandler } from '@/modules/notification';
import { systemHandler } from '@/modules/system';

const MAX_REQUEST_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_QUERY_PARAM_LENGTH = 1024; // 1KB

/**
 * Create and configure the Elysia application.
 * This function's return type is inferred by TypeScript and used
 * by Eden Treaty for type-safe client generation.
 */
export function createApp() {
  return new Elysia()
    // --- LAYER 0: API DOCUMENTATION ---
    .use(swagger({
      path: '/docs',
      documentation: {
        info: {
          title: 'Buddy Wallet API',
          version: '1.0.0',
          description: 'Debt management and tracking API'
        },
        tags: [
          { name: 'auth', description: 'Authentication endpoints' },
          { name: 'debts', description: 'Debt management endpoints' },
          { name: 'user', description: 'User profile endpoints' },
          { name: 'bank', description: 'Bank account endpoints' },
          { name: 'storage', description: 'File storage endpoints' },
          { name: 'data', description: 'Import/Export endpoints' },
          { name: 'notification', description: 'Notification endpoints' },
          { name: 'system', description: 'System health endpoints' }
        ]
      }
    }))
    // --- LAYER 1: GLOBAL SECURITY & CACHING ---
    .use(etag())
    .use(corsPlugin)
    .use(csrfPlugin)
    .use(securityHeadersPlugin)

    // --- LAYER 2: INFRASTRUCTURE & OBSERVABILITY ---
    .derive(({ request }) => {
      const requestId = request.headers.get('X-Request-ID') || randomUUIDv7();
      return { requestId };
    })
    .onAfterHandle(({ requestId, set }) => {
      set.headers['X-Request-ID'] = requestId;
    })
    .onBeforeHandle(({ request, set }) => {
      const contentLengthHeader = request.headers.get('content-length');
      if (contentLengthHeader) {
        const contentLength = Number.parseInt(contentLengthHeader, 10);
        if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
          set.status = 413;
          return apiError(GEN_ERRORS.INVALID_INPUT, 'Payload too large');
        }
      }

      const requestUrl = new URL(request.url);
      for (const [key, value] of requestUrl.searchParams.entries()) {
        if (value.length > MAX_QUERY_PARAM_LENGTH) {
          set.status = 400;
          return apiError(GEN_ERRORS.INVALID_INPUT, `Query parameter "${key}" is too long`);
        }
      }
    })
    // Global error handler
    .onError(({ code, error, set }) => {
      logger.app('Global error caught', {
        code,
        error: String(error),
        stack: (error as Error)?.stack
      });

      const errorByCode: Record<
        string,
        { status: number; error: (typeof GEN_ERRORS)[keyof typeof GEN_ERRORS] }
      > = {
        NOT_FOUND: { status: 404, error: GEN_ERRORS.NOT_FOUND },
        VALIDATION: { status: 400, error: GEN_ERRORS.VALIDATION },
        PARSE: { status: 400, error: GEN_ERRORS.INVALID_INPUT }
      };

      const mapped = errorByCode[code] ?? { status: 500, error: GEN_ERRORS.UNKNOWN };
      if (typeof set.status !== 'number' || set.status < 400) {
        set.status = mapped.status;
      }

      const detailMessage = configs.APP.IS_PRODUCTION ? undefined : (error as Error)?.message;
      return apiError(mapped.error, detailMessage);
    })
    .use(telemetry ?? new Elysia())
    .use(redisPlugin)
    .use(requestLoggerPlugin)

    // --- LAYER 3: AUTH CONTEXT ---
    .use(actor)

    // --- LAYER 4: SYSTEM ROUTES (PUBLIC) ---
    .use(systemHandler.register())

    // --- LAYER 5: BUSINESS LOGIC & API V1 ---
    .group('/v1', (api) =>
      api
        // Public routes (no auth required)
        .use(authHandler.register())
        // Protected routes enforce auth through requireUser wrappers.
        .use(userHandler.register())
        .use(debtsHandler.register())
        .use(dataHandler.register())
        .use(bankHandler.register())
        .use(storageHandler.register())
        .use(notificationHandler.register())
    );
}

// Singleton app instance for testing and reuse
// Type is inferred from createApp() — preserves full Elysia type chain for Eden Treaty
let appInstance: ReturnType<typeof createApp> | null = null;

/**
 * Bootstrap the Elysia application with all configurations.
 * Returns a cached singleton on subsequent calls.
 */
export async function bootstrap() {
  if (appInstance) return appInstance;

  // 1. Validate environment variables
  validateRuntimeEnv();

  // 2. Create and configure Elysia app
  appInstance = createApp();

  return appInstance;
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
