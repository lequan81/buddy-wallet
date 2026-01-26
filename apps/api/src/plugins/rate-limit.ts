import { Elysia } from 'elysia';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Custom key generator (default: IP address) */
  keyGenerator?: (request: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (request: Request) => boolean;
  /** Custom error message */
  message?: string;
}

// In-memory store (consider Redis for production with multiple instances)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Get client IP address from request
 */
function getClientIP(request: Request): string {
  // Check common proxy headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback (in Bun/Elysia, this might need server context)
  return 'unknown';
}

/**
 * Create a rate limiting plugin with configurable options
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => getClientIP(req),
    skip,
    message = 'Too many requests, please try again later'
  } = config;

  return new Elysia({ name: `Rate_Limiter_${windowMs}_${maxRequests}` }).onBeforeHandle(
    ({ request, set }) => {
      // Skip if configured
      if (skip && skip(request)) {
        return;
      }

      const key = keyGenerator(request);
      const now = Date.now();

      let entry = rateLimitStore.get(key);

      if (!entry || entry.resetAt < now) {
        // Create new entry
        entry = {
          count: 1,
          resetAt: now + windowMs
        };
        rateLimitStore.set(key, entry);
      } else {
        // Increment existing entry
        entry.count++;
      }

      // Set rate limit headers
      set.headers['X-RateLimit-Limit'] = String(maxRequests);
      set.headers['X-RateLimit-Remaining'] = String(Math.max(0, maxRequests - entry.count));
      set.headers['X-RateLimit-Reset'] = String(Math.ceil(entry.resetAt / 1000));

      // Check if limit exceeded
      if (entry.count > maxRequests) {
        set.status = 429;
        set.headers['Retry-After'] = String(Math.ceil((entry.resetAt - now) / 1000));
        return {
          success: false,
          message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((entry.resetAt - now) / 1000)
        };
      }
    }
  );
}

/**
 * Pre-configured rate limiters for common use cases
 */

// Strict: 5 requests per minute (for sensitive endpoints like public lookup)
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  message: 'Too many requests. Please wait before trying again.'
});

// Auth: 10 requests per minute (for login/register)
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many authentication attempts. Please wait before trying again.'
});

// Standard: 100 requests per minute (for general API)
export const standardRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Rate limit exceeded. Please slow down.'
});

// Burst: 30 requests per 10 seconds (for quick bursts)
export const burstRateLimiter = createRateLimiter({
  windowMs: 10 * 1000, // 10 seconds
  maxRequests: 30,
  message: 'Too many requests in a short time. Please slow down.'
});
