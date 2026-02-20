import { Elysia } from 'elysia';
import { configs } from '../../configs';
import { logger } from '@repo/logger';

// Support comma-separated origins for dev/staging/prod
const allowedOrigins = configs.APP.WEB_URL.split(',').map((o) => o.trim());

// CSRF secret - reuse JWT secret for consistency
const CSRF_SECRET = configs.AUTH.JWT_SECRET;

/**
 * Hybrid CSRF Protection Plugin
 *
 * Two-layer protection:
 * 1. Token-based (Bun.CSRF) - for form submissions with X-CSRF-Token header
 * 2. Origin/Referer check - fallback for SPA API calls
 */
export const csrfPlugin = new Elysia({ name: 'CSRF_Plugin' })
  // Derive CSRF token generator for responses
  .derive({ as: 'global' }, () => ({
    /**
     * Generate a CSRF token for the current request
     * Include this in response headers or body for forms
     */
    generateCsrfToken: () => Bun.CSRF.generate(CSRF_SECRET)
  }))

  .onBeforeHandle(({ request, set }) => {
    // Skip checking for GET/HEAD/OPTIONS methods (safe methods)
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return;
    }

    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const csrfToken = request.headers.get('x-csrf-token');

    // 1. Token-based check (Bun.CSRF) - highest priority
    // If a CSRF token is provided, verify it first
    if (csrfToken) {
      const isValidToken = Bun.CSRF.verify(csrfToken, { secret: CSRF_SECRET });
      if (isValidToken) {
        logger.csrf('Allowed - Valid CSRF token');
        return; // Token is valid, allow request
      }
      // Token provided but invalid - continue to Origin check
      logger.csrf(`CSRF token provided but invalid`);
    }

    // 2. Strict Origin Check (fallback for SPA API calls)
    // If we have an origin, it MUST be in the allowed list
    if (origin && !allowedOrigins.includes(origin)) {
      logger.csrf(`Blocked - Invalid Origin: ${origin}`);
      set.status = 403;
      return {
        success: false,
        message: 'Invalid Origin',
        code: 'CSRF_ORIGIN_MISMATCH'
      };
    }

    // 3. Referer Check
    // If we have a referer, it MUST start with one of the allowed origins
    if (referer && !allowedOrigins.some((allowed) => referer.startsWith(allowed))) {
      logger.csrf(`Blocked - Invalid Referer: ${referer}`);
      set.status = 403;
      return {
        success: false,
        message: 'Invalid Referer',
        code: 'CSRF_REFERER_MISMATCH'
      };
    }

    // 4. Fallback: If neither Origin nor Referer is present, block request
    if (!origin && !referer) {
      logger.csrf('Blocked - Missing Origin and Referer');
      set.status = 403;
      return {
        success: false,
        message: 'Missing Origin and Referer',
        code: 'CSRF_NO_ORIGIN_OR_REFERER'
      };
    }

    // Origin or Referer is valid
  });
