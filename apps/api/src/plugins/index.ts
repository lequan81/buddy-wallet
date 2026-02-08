/**
 * Plugins - Central export for all Elysia plugins
 *
 * Organized into subfolders:
 * - guards/     - Permission and access control guards
 * - middleware/ - Request processing, security, logging
 * - auth/       - JWT and session authentication
 * - redis/      - Redis caching and connection
 */

// Auth plugins
export * from './auth';

// Guards
export * from './guards';

// Middleware
export * from './middleware';

// Redis
export * from './redis';

// Access control (combined plugin)
export { accessControlPlugin } from './access-control.plugin';
