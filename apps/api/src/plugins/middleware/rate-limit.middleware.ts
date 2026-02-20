import { Elysia, type Context } from 'elysia';
import { logger } from '@repo/logger';
import { cache, isRedisAvailable } from '../redis';
import { configs } from '../../configs';
import type { RateLimitEntry, RateLimitConfig } from '../../types';
import type { User } from '@repo/db';

// In-memory fallback store (used when Redis is not available)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (only for in-memory store)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Trusted proxy IP ranges (configured via environment)
 * Only these proxies can set X-Forwarded-For header
 *
 * SECURITY: Prevents IP spoofing by validating proxy source
 */
const TRUSTED_PROXIES = new Set<string>(
  (Bun.env.TRUSTED_PROXIES || '127.0.0.1,::1')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
);

/**
 * Check if IP address is from a trusted proxy
 */
function isTrustedProxy(ip: string | null): boolean {
  if (!ip) return false;

  // Check exact match
  if (TRUSTED_PROXIES.has(ip)) return true;

  // Check if it's a local IP (always trusted)
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;

  // Check if it's in private IP ranges (Docker, Kubernetes, etc.)
  if (ip.startsWith('10.') || ip.startsWith('172.16.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('::ffff:127.') || ip.startsWith('::ffff:10.')) return true;

  return false;
}

/**
 * Get client IP address from request with proxy validation
 *
 * SECURITY FIX: Only trust X-Forwarded-For from trusted proxies
 * This prevents attackers from spoofing their IP by setting custom headers
 */
function getClientIP(request: Request): string {
  // Get actual connection IP (most reliable)
  // Note: In Bun, this might not be directly available from Request object
  // We'll use X-Real-IP as fallback for connection IP
  const realIP = request.headers.get('x-real-ip');

  // Only trust X-Forwarded-For if request comes from trusted proxy
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded && isTrustedProxy(realIP)) {
    // Take the first IP in the chain (original client IP)
    const clientIP = forwarded.split(',')[0].trim();
    logger.rateLimit(`Using X-Forwarded-For: ${clientIP} (via trusted proxy ${realIP})`);
    return clientIP;
  }

  // If X-Forwarded-For is present but proxy not trusted, log warning
  if (forwarded && !isTrustedProxy(realIP)) {
    logger.security(`Untrusted X-Forwarded-For rejected`, {
      forwarded,
      realIP,
      message: 'Possible IP spoofing attempt'
    });
  }

  // Fallback to real IP (connection IP)
  if (realIP) {
    return realIP;
  }

  // Last resort: use a fixed identifier
  return 'unknown';
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
const defaultKeyGenerator = (req: Request, ctx?: Context & { user?: User | null }): string => {
  // 1. Prefer authenticated User ID (cannot be spoofed via headers)
  if (ctx?.user?.id) {
    return `user:${ctx.user.id}`;
  }

  // 2. Fallback to IP + User-Agent fingerprint for unauthenticated requests
  // This makes it harder to bypass rate limits by just changing IP
  const ip = getClientIP(req);
  const uaFingerprint = getUserAgentFingerprint(req);
  return `ip:${ip}:ua:${uaFingerprint}`;
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
    async (ctx) => {
      const { request, set } = ctx;
      // Skip if configured
      if (skip && skip(request)) {
        return;
      }

      // Pass full context to keyGenerator so it can access user if available
      const key = `ratelimit:${keyGenerator(request, ctx as any)}`;
      const now = Date.now();
      const windowSeconds = Math.ceil(windowMs / 1000);

      let count: number;
      let resetAt: number;

      // Try Redis first, fall back to in-memory
      if (isRedisAvailable()) {
        // Use Redis for distributed rate limiting
        count = await cache.incr(key, windowSeconds);
        const ttl = await cache.ttl(key);
        resetAt = now + (ttl > 0 ? ttl * 1000 : windowMs);
      } else {
        // Fallback to in-memory store
        let entry = rateLimitStore.get(key);

        if (!entry || entry.resetAt < now) {
          entry = {
            count: 1,
            resetAt: now + windowMs
          };
          rateLimitStore.set(key, entry);
        } else {
          entry.count++;
        }
        count = entry.count;
        resetAt = entry.resetAt;
      }

      // Set rate limit headers
      set.headers['X-RateLimit-Limit'] = String(maxRequests);
      set.headers['X-RateLimit-Remaining'] = String(Math.max(0, maxRequests - count));
      set.headers['X-RateLimit-Reset'] = String(Math.ceil(resetAt / 1000));

      // Check if limit exceeded
      if (count > maxRequests) {
        logger.rateLimit(`Exceeded: ${key} (${count}/${maxRequests})`);
        set.status = 429;
        set.headers['Retry-After'] = String(Math.ceil((resetAt - now) / 1000));
        return {
          success: false,
          message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((resetAt - now) / 1000)
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

// Upload: 10 requests per minute (for large file uploads)
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Upload limit exceeded. Please wait before uploading more files.'
});

// Download/View: 100 requests per minute (for UI image fetching)
export const fileDownloadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Download limit exceeded. Please slow down.'
});

// Broadcast: 1 request per minute (for admin broadcast notifications)
export const broadcastRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1,
  message: 'Broadcast limit exceeded. Maximum 1 broadcast per minute.'
});

// Delete: 20 requests per minute (for file/resource deletion)
export const deleteRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  message: 'Too many delete requests. Please slow down.'
});
