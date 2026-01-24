import { Elysia } from 'elysia';
import { configs } from '../configs';

export const csrfPlugin = new Elysia({ name: 'CSRF_Protection' }).onBeforeHandle(
  ({ request, set }) => {
    // Skip checking for GET/HEAD/OPTIONS methods (safe methods)
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return;
    }

    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const allowedOrigin = configs.WEB_URL;

    // 1. Strict Origin Check
    // If we have an origin, it MUST match the allowed origin.
    if (origin && origin !== allowedOrigin) {
      set.status = 403;
      return {
        success: false,
        message: 'Invalid Origin',
        code: 'CSRF_ORIGIN_MISMATCH'
      };
    }

    // 2. Referer Check
    // If we have a referer, it MUST start with the allowed origin.
    if (referer && !referer.startsWith(allowedOrigin)) {
      set.status = 403;
      return {
        success: false,
        message: 'Invalid Referer',
        code: 'CSRF_REFERER_MISMATCH'
      };
    }

    // 3. Fallback: If neither Origin nor Referer is present, block request?
    // For now, we assume at least one is present for state-changing requests from browsers.
    if (!origin && !referer) {
      set.status = 403;
      return {
        success: false,
        message: 'Missing Origin and Referer',
        code: 'CSRF_NO_ORIGIN_OR_REFERER'
      };
    }
  }
);
