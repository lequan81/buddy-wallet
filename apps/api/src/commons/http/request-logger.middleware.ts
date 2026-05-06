/**
 * Request Logger Middleware
 * 
 * Logs incoming HTTP requests for debugging and monitoring
 * @logicType http
 */

import { Elysia } from 'elysia';
import { logger } from '@repo/logger';

const requestStartTimes = new WeakMap<Request, number>();

export const requestLoggerPlugin = new Elysia({
  name: 'request-logger'
}).onBeforeHandle(({ request }) => {
  const start = Date.now();
  requestStartTimes.set(request, start);

  logger.info('Incoming request', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries())
  });
}).onAfterHandle(({ request, set }) => {
  const startTime = requestStartTimes.get(request);
  const duration = startTime ? Date.now() - startTime : 0;
  const status = typeof set.status === 'number' ? set.status : 200;

  logger.info('Request completed', {
    method: request.method,
    url: request.url,
    status,
    duration
  });

  requestStartTimes.delete(request);
});
