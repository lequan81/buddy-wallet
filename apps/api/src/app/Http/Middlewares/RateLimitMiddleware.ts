/**
 * Rate Limit Middleware
 *
 * Limits requests per IP/user.
 */

import { Elysia } from 'elysia';
import { RateLimitException } from '@/app/Exceptions';

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number; // milliseconds
  keyGenerator?: (ctx: any) => string; // default: IP
}

/**
 * Create rate limit middleware
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  const requests = new Map<string, { count: number; resetAt: number }>();

  const getKey = (ctx: any): string => {
    if (options.keyGenerator) {
      return options.keyGenerator(ctx);
    }
    return ctx.request.headers.get('x-forwarded-for') || 'unknown';
  };

  return new Elysia({ name: 'RateLimit' })
    .onBeforeHandle(async ({ request, set }) => {
      const key = getKey({ request });
      const now = Date.now();
      const record = requests.get(key);

      if (record) {
        if (now < record.resetAt) {
          // Still within window
          record.count++;
          if (record.count > options.maxRequests) {
            set.status = 429;
            set.headers['Retry-After'] = String(Math.ceil((record.resetAt - now) / 1000));
            throw new RateLimitException('Too many requests', Math.ceil((record.resetAt - now) / 1000));
          }
        } else {
          // Window expired, reset
          requests.set(key, { count: 1, resetAt: now + options.windowMs });
        }
      } else {
        // First request
        requests.set(key, { count: 1, resetAt: now + options.windowMs });
      }
    });
}

/**
 * Default rate limit: 100 requests per 15 minutes
 */
export const rateLimitMiddleware = createRateLimitMiddleware({
  maxRequests: 100,
  windowMs: 15 * 60 * 1000
});
