/**
 * Rate Limiting Type Definitions
 */

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Custom key generator (default: IP address) */
  keyGenerator?: (
    request: Request,
    ctx?: { user?: { id: string } }
  ) => string | Promise<string>;
  /** Skip rate limiting for certain requests */
  skip?: (request: Request) => boolean;
  /** Custom error message */
  message?: string;
}

