/**
 * Idempotency Plugin for ElysiaJS
 * Provides idempotency key handling for POST/PUT/PATCH operations
 */
import { Elysia } from 'elysia';
import { getIdempotentResponse, storeIdempotentResponse } from '../utils/idempotency.utils';
import { logger } from '@repo/logger';

/**
 * Create an idempotency-aware handler wrapper
 * Usage: Apply to routes that need idempotency protection
 */
export function withIdempotency<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  options?: { getKey?: (ctx: any) => string | null }
): T {
  return (async (ctx: any) => {
    const key = options?.getKey?.(ctx) || ctx.headers['idempotency-key'] || ctx.headers['Idempotency-Key'];

    if (key) {
      // Check for existing response
      const cached = await getIdempotentResponse<ReturnType<T>>(key);
      if (cached) {
        logger.info('Returning idempotent response', { key, path: ctx.request.url });
        ctx.set.headers['X-Idempotency-Key'] = key;
        ctx.set.headers['X-Idempotency-Replay'] = 'true';
        return cached;
      }
    }

    // Execute handler
    const result = await handler(ctx);

    // Store response if idempotency key was provided
    if (key && result) {
      await storeIdempotentResponse(key, result);
      ctx.set.headers['X-Idempotency-Key'] = key;
    }

    return result;
  }) as T;
}

/**
 * Elysia plugin that adds idempotency support to routes
 * Usage:
 * .post('/debts', handler, {
 *   headers: t.Object({ 'idempotency-key': t.Optional(t.String()) })
 * })
 */
export const idempotencyPlugin = new Elysia({ name: 'Idempotency' })
  .derive(({ headers }) => ({
    idempotencyKey: headers['idempotency-key'] || headers['Idempotency-Key'] || null
  }));
