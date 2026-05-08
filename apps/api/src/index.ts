/**
 * Application Entry Point
 *
 * Initializes and starts the Elysia API server using bootstrap.
 */

import { start, bootstrap } from './bootstrap';

// Re-export types for Eden Treaty clients
export type { createApp } from './bootstrap';
export type App = ReturnType<typeof import('./bootstrap').createApp>;

// Export app for testing
export const app = await bootstrap();

if (import.meta.main) {
  start().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}
