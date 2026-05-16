import { Elysia, type Context } from 'elysia';
import { logger } from '@repo/logger';
import { getClientIP } from '@/commons/security/ip/extract';
import { configs } from '@/config';
import { BE_ERRORS } from '@repo/errors';
import { apiError } from '@/commons/http/response';
import { cache } from '@/providers/redis';
import type { Server } from 'bun';

interface RateLimitContext {
  user?: { id: string };
  server?: Server<any>;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: Request, ctx?: RateLimitContext) => string | Promise<string>;
  skip?: (request: Request, ctx?: RateLimitContext) => boolean;
  message?: string;
}

/**
 * Get User-Agent fingerprint for additional rate limiting factor
 */
function getUserAgentFingerprint(request: Request): string {
  const ua = request.headers.get('user-agent') || 'unknown';
  // Simple hash of user agent (first 8 chars)
  let hash = 0;
  for (let i = 0; i < ua.length; i++) {
    hash = (hash << 5) - hash + ua.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

/**
 * Custom key generator that prioritizes authenticated User ID
 *
 * SECURITY: Multi-factor rate limiting
 * - Authenticated requests: by user ID (can't be spoofed)
 * - Unauthenticated requests: by IP + User-Agent fingerprint (harder to spoof)
 */
export const defaultKeyGenerator = (request: Request, ctx?: RateLimitContext): string => {
  // 1. Prefer authenticated User ID (cannot be spoofed via headers)
  if (ctx?.user?.id) {
    return `user:${ctx.user.id}`;
  }

  // 2. Fallback to IP + User-Agent fingerprint for unauthenticated requests
  const ip = getClientIP(request, ctx?.server ?? null) || 'unknown';
  const uaFingerprint = getUserAgentFingerprint(request);
  return `ip:${ip}:ua:${uaFingerprint}`;
};

const safeNormalizeIdentifier = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return normalized.slice(0, 120);
};

/**
 * Build key generator for endpoints that should rate limit by identifier (email/phone).
 * Falls back to the default key generator when identifier is unavailable.
 */
export const identifierKeyGenerator =
  (...fields: string[]) =>
    async (request: Request, ctx?: RateLimitContext): Promise<string> => {
      const fallback = defaultKeyGenerator(request, ctx);
      if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'PATCH') {
        return fallback;
      }

      try {
        const body = (await request.clone().json()) as Record<string, unknown>;
        for (const field of fields) {
          const normalized = safeNormalizeIdentifier(body[field]);
          if (normalized) {
            return `id:${field}:${normalized}`;
          }
        }
      } catch {
        // Body may not be JSON; use fallback key.
      }
      return fallback;
    };

/**
 * Create a rate limiting plugin with configurable options
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    skip,
    message = 'Too many requests, please try again later'
  } = config;

  return new Elysia({ name: `Rate_Limiter_${windowMs}_${maxRequests}` }).onBeforeHandle(
    async (ctx: Context) => {
      const { request, set } = ctx;
      // Skip if configured
      if (skip && skip(request)) {
        return;
      }

      // Pass full context to keyGenerator so it can access user if available
      const rateLimitCtx: RateLimitContext = {
        user: (ctx as { user?: { id: string } }).user,
        server: (ctx as { server?: Server<any> }).server
      };
      const generatedKey = await keyGenerator(request, rateLimitCtx);
      const key = `ratelimit:${generatedKey}`;
      const now = Date.now();
      const windowSeconds = Math.ceil(windowMs / 1000);

      // Atomic increment to avoid race conditions under concurrent requests.
      const count = await cache.incr(key, windowSeconds);
      if (count < 0) {
        return;
      }
      const ttlSeconds = await cache.ttl(key);
      const retryAfter = ttlSeconds > 0 ? ttlSeconds : windowSeconds;
      const resetAt = now + retryAfter * 1000;

      // Set rate limit headers
      set.headers['X-RateLimit-Limit'] = String(maxRequests);
      set.headers['X-RateLimit-Remaining'] = String(Math.max(0, maxRequests - count));
      set.headers['X-RateLimit-Reset'] = String(Math.ceil(resetAt / 1000));

      // Check if limit exceeded
      if (count > maxRequests) {
        logger.rateLimit(`Exceeded: ${key} (${count}/${maxRequests})`);
        set.status = 429;
        set.headers['Retry-After'] = String(retryAfter);
        return apiError(
          BE_ERRORS.RATE_LIMITED,
          `${message}. Retry after ${retryAfter} seconds.`
        );
      }
    }
  );
}

/**
 * Pre-configured rate limiters for common use cases
 */

// Strict: 5 requests per minute (for sensitive endpoints like public lookup)
export const strictRateLimiter = createRateLimiter(configs.RATE_LIMITS.STRICT);

// Auth: 10 requests per minute (for login/register)
export const authRateLimiter = createRateLimiter(configs.RATE_LIMITS.AUTH);

// Auth (identifier-aware): limits by email/phone when present in request payload.
export const authIdentifierRateLimiter = createRateLimiter({
  ...configs.RATE_LIMITS.AUTH,
  keyGenerator: identifierKeyGenerator('identifier', 'email', 'phoneNumber')
});

// Password recovery request limiter (identifier-aware by email/phone).
export const authRecoveryRateLimiter = createRateLimiter({
  ...configs.RATE_LIMITS.AUTH_RECOVERY,
  keyGenerator: identifierKeyGenerator('email', 'phoneNumber')
});

// Password reset token usage limiter (identifier-aware by email/token).
export const authResetRateLimiter = createRateLimiter({
  ...configs.RATE_LIMITS.AUTH_RESET,
  keyGenerator: identifierKeyGenerator('email', 'token')
});

// OTP verification/resend limiter (identifier-aware by email).
export const authOtpRateLimiter = createRateLimiter({
  ...configs.RATE_LIMITS.AUTH_OTP,
  keyGenerator: identifierKeyGenerator('email')
});

// Standard: 100 requests per minute (for general API)
export const standardRateLimiter = createRateLimiter(configs.RATE_LIMITS.STANDARD);

// Burst: 30 requests per 10 seconds (for quick bursts)
export const burstRateLimiter = createRateLimiter(configs.RATE_LIMITS.BURST);

// Upload: 10 requests per minute (for large file uploads)
export const uploadRateLimiter = createRateLimiter(configs.RATE_LIMITS.UPLOAD);

// Download/View: 100 requests per minute (for UI image fetching)
export const fileDownloadRateLimiter = createRateLimiter(configs.RATE_LIMITS.DOWNLOAD);

// Broadcast: 1 request per minute (for admin broadcast notifications)
export const broadcastRateLimiter = createRateLimiter(configs.RATE_LIMITS.BROADCAST);

// Delete: 20 requests per minute (for file/resource deletion)
export const deleteRateLimiter = createRateLimiter(configs.RATE_LIMITS.DELETE);
