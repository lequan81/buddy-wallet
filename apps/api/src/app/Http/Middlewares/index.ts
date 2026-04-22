/**
 * HTTP Middlewares - Central export point
 *
 * Middlewares are different from Plugins:
 * - Middlewares: Transform requests/responses (traditional pattern)
 * - Plugins: Extend Elysia context with .derive() and .macro()
 *
 * For Elysia plugins, use `@/app/Providers/Plugins/`
 * For infrastructure (Redis, Telemetry), use `@/infra/`
 */

// Rate Limiting
export * from './RateLimiting/RateLimitMiddleware';

// Security
export { corsPlugin } from './Security/CorsMiddleware';
export { csrfPlugin } from './Security/CsrfMiddleware';
export { securityHeadersPlugin } from './Security/SecurityHeadersMiddleware';

// Logging
export { requestLoggerPlugin } from './Logging/RequestLoggerMiddleware';

// Pagination
export * from './Pagination/PaginationMiddleware';
