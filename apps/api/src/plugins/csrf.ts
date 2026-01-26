import { Elysia } from 'elysia';
import { configs } from '../configs';

// Support comma-separated origins for dev/staging/prod
const allowedOrigins = configs.WEB_URL.split(',').map((o) => o.trim());

export const csrfPlugin = new Elysia({ name: 'CSRF_Plugin' }).onBeforeHandle(
  ({ request, set }) => {
    // Skip checking for GET/HEAD/OPTIONS methods (safe methods)
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return;
    }

    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    // 1. Strict Origin Check
    // If we have an origin, it MUST be in the allowed list
    if (origin && !allowedOrigins.includes(origin)) {
      set.status = 403;
      return {
        success: false,
        message: 'Invalid Origin',
        code: 'CSRF_ORIGIN_MISMATCH'
      };
    }

    // 2. Referer Check
    // If we have a referer, it MUST start with one of the allowed origins
    if (referer && !allowedOrigins.some((allowed) => referer.startsWith(allowed))) {
      set.status = 403;
      return {
        success: false,
        message: 'Invalid Referer',
        code: 'CSRF_REFERER_MISMATCH'
      };
    }

    // 3. Fallback: If neither Origin nor Referer is present, block request
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
