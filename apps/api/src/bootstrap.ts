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
import { traceStore } from '@/providers/telemetry';

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
} from '@/plugins';
import { actor } from '@/modules/auth/plugins/actor.plugin';
import { apiError } from '@/commons/http/response';

// Business Logic Modules
import { authRoutes } from '@/modules/auth/routes';
import { debtRoutes } from '@/modules/debts/routes';
import { bankRoutes } from '@/modules/bank/routes';
import { storageRoutes } from '@/modules/storage/routes';
import { userRoutes } from '@/modules/user/routes';
import { dataRoutes } from '@/modules/data/routes';
import { notificationRoutes } from '@/modules/notification/routes';
import { proofRoutes } from '@/modules/proof/routes';
import { activityRoutes } from '@/modules/activity/routes';
import { healthRoutes, debugRoutes } from '@/modules/system';
import { publicRoutes } from '@/modules/public';
import { system } from '@/modules/system/handlers/system.handler';

const MAX_REQUEST_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_QUERY_PARAM_LENGTH = 1024; // 1KB

/**
 * Create and configure the Elysia application.
 * This function's return type is inferred by TypeScript and used
 * by Eden Treaty for type-safe client generation.
 */
export function createApp() {
  return new Elysia()
    // --- LAYER -1: URL NORMALIZATION & SECURITY MIDDLEWARE ---
    .onRequest(({ request, set }) => {
      const url = new URL(request.url);
      const pathname = url.pathname;

      let decodedPath = pathname;
      try {
        decodedPath = decodeURIComponent(pathname);
      } catch (_e) {
        // Keep original if decoding fails
      }

      // Block path traversal attempts
      if (decodedPath.includes('..') || decodedPath.includes('./') || decodedPath.includes('/.')) {
        set.status = 400;
        return apiError(GEN_ERRORS.INVALID_INPUT, 'Invalid URL path pattern');
      }

      let normalizedPath = decodedPath;

      // 1. Normalize duplicate slashes (e.g., //auth//login -> /auth/login)
      if (normalizedPath.includes('//')) {
        normalizedPath = normalizedPath.replace(/\/+/g, '/');
      }

      // 2. Normalize trailing slashes (except for root "/")
      if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
        normalizedPath = normalizedPath.slice(0, -1);
      }

      // 3. Rewrite request URL if changed via clean, native HTTP redirection
      if (normalizedPath !== pathname) {
        url.pathname = normalizedPath;
        return Response.redirect(url.href, 301);
      }
    })
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
          { name: 'activity', description: 'Activity log endpoints' },
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
    .onError(({ code, error, set, request }) => {
      const errorObj = error as { message?: unknown; code?: unknown } | undefined;
      const errorMessage = typeof errorObj?.message === 'string' ? errorObj.message : '';
      const errorCode = typeof errorObj?.code === 'string' ? errorObj.code : '';

      const isNotFound =
        code === 'NOT_FOUND' ||
        String(code) === 'NOT_FOUND' ||
        errorCode === 'NOT_FOUND' ||
        errorMessage.includes('NOT_FOUND') ||
        errorMessage.includes('not found');

      if (isNotFound) {
        let path = '/';
        try {
          const urlObj = new URL(request?.url || '');
          path = urlObj.pathname + urlObj.search;
        } catch (_e) {
          // Keep default
        }

        logger.app(`Route not found: ${request?.method || 'GET'} ${request?.url || ''}`);

        traceStore.add({
          id: randomUUIDv7(),
          traceId: (request?.headers?.get('X-Request-ID') as string | undefined) || randomUUIDv7(),
          name: 'request',
          method: request?.method || 'GET',
          path: path,
          status: 'error',
          duration: 0.2,
          startTime: Date.now(),
          timestamp: new Date(),
          attributes: {
            'http.status_code': 404
          }
        });

        set.status = 404;
        return apiError(GEN_ERRORS.NOT_FOUND, `Route not found: ${path}`);
      }

      logger.app('Global error caught', {
        code,
        error: String(error),
        url: request?.url,
        method: request?.method,
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

    // --- LAYER 4: ROOT HEALTH & STATUS ENDPOINTS ---
    .get('/', () => system.root())
    .get('/favicon.ico', ({ set }) => {
      set.status = 204;
      return;
    })
    .use(healthRoutes)
    .use(debugRoutes)
    .get('/css/:filename', async ({ params, set }) => {
      const filePath = `${import.meta.dir}/static/css/${params.filename}`;
      const file = Bun.file(filePath);
      if (await file.exists()) {
        set.headers['content-type'] = 'text/css; charset=utf-8';
        return file;
      }
      set.status = 404;
      return apiError(GEN_ERRORS.NOT_FOUND, 'CSS file not found');
    })

    // --- LAYER 5: API ROUTES ---
    .group('/v1', (v1) => v1
        // Public routes (no auth required)
        .use(publicRoutes)

        // --- LAYER 3: AUTH CONTEXT ---
        // Applied only to routes that require authentication
        .use(actor)

        // Business logic routes (protected)
        .use(authRoutes)
        .use(userRoutes)
        .use(debtRoutes)
        .use(dataRoutes)
        .use(bankRoutes)
        .use(storageRoutes)
        .use(notificationRoutes)
        .use(proofRoutes)
        .use(activityRoutes)
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
