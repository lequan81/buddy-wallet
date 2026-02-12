/**
 * Security Headers Plugin
 *
 * Adds essential security headers to all responses:
 * - X-Frame-Options: Prevent clickjacking
 * - X-Content-Type-Options: Prevent MIME sniffing
 * - Content-Security-Policy: Control resource loading
 * - Permissions-Policy: Control browser features
 */
import { Elysia } from 'elysia';
import { configs } from '../../configs';

// Environment-aware allowed domains for connect-src
const getAllowedConnectSrc = (): string => {
  if (configs.APP.IS_DEV) {
    return "'self' http://localhost:3000 ws://localhost:*";
  }
  return "'self' https://anonychat.vinaddns.com wss://anonychat.vinaddns.com";
};

export const securityHeadersPlugin = new Elysia({ name: 'Security_Headers' }).onBeforeHandle(
  ({ set }) => {
    // Prevent clickjacking
    set.headers['X-Frame-Options'] = 'DENY';

    // Prevent MIME-type sniffing
    set.headers['X-Content-Type-Options'] = 'nosniff';

    // Content Security Policy (with Cloudflare + Google Analytics)
    set.headers['Content-Security-Policy'] = [
      "default-src 'self'",
      // Scripts: self + inline + Cloudflare + Google Analytics
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      // Connect: environment-aware + analytics endpoints
      `connect-src ${getAllowedConnectSrc()} https://www.google-analytics.com https://cloudflareinsights.com`,
      "frame-ancestors 'none'",
      "worker-src 'self' blob:"
    ].join('; ');

    // Additional security headers
    set.headers['X-XSS-Protection'] = '1; mode=block';
    set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

    // Permissions-Policy - Allow required features
    set.headers['Permissions-Policy'] = [
      'push=(self)',
      'notifications=(self)',
      'geolocation=(self)',
      'camera=()',
      'payment=(self)'
    ].join(', ');
  }
);
