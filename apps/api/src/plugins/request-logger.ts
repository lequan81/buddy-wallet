/**
 * Request Logger Plugin for ElysiaJS
 * Automatically logs HTTP requests and responses with timing
 */

import { Elysia } from 'elysia';
import { logger, type LogContext } from '../utils/logger';

export const requestLoggerPlugin = new Elysia({ name: 'Request_Logger' })
  .derive(() => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const startTime = performance.now();
    return { requestId, startTime };
  })
  .onAfterResponse(({ request, set, requestId, startTime }) => {
    const duration = Math.round(performance.now() - (startTime ?? 0));
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;
    const status = typeof set.status === 'number' ? set.status : 200;

    const ctx: LogContext = {
      requestId,
      method,
      path,
      status,
      duration,
    };

    // Color-code by status in log message
    const statusIndicator = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✓';
    logger.http(`${statusIndicator} ${method} ${path} ${status} ${duration}ms`, ctx);
  })
  .onError(({ error, request, requestId, startTime }) => {
    const duration = Math.round(performance.now() - (startTime ?? 0));
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    const errorMessage = 'message' in error ? String(error.message) : 'Unknown error';
    const errorStack = 'stack' in error ? String(error.stack) : undefined;

    logger.error(`${method} ${path} failed`, {
      requestId,
      method,
      path,
      duration,
      error: errorMessage,
      stack: Bun.env.NODE_ENV !== 'production' ? errorStack : undefined,
    });
  });
