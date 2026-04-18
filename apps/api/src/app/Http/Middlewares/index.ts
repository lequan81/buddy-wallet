/**
 * HTTP Middlewares - Request processing, security, and logging
 *
 * Per Laravel convention, all middleware is centralized in app/Http/Middlewares/
 */

// CORS and CSRF protection
export { corsPlugin } from './cors.middleware';
export { csrfPlugin } from './csrf.middleware';

// Rate limiting with configurable options
export {
  authRateLimiter,
  authIdentifierRateLimiter,
  authRecoveryRateLimiter,
  authResetRateLimiter,
  authOtpRateLimiter,
  standardRateLimiter,
  strictRateLimiter,
  burstRateLimiter,
  uploadRateLimiter,
  broadcastRateLimiter,
  deleteRateLimiter,
  createRateLimiter,
  fileDownloadRateLimiter,
  identifierKeyGenerator,
  defaultKeyGenerator
} from './rate-limit.middleware';

// Logging and pagination
export { requestLoggerPlugin } from './request-logger.middleware';
export { securityHeadersPlugin } from './security-headers.middleware';
export { paginationMiddleware, validatePaginationParams } from './pagination.middleware';

