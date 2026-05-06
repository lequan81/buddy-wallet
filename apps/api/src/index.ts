/**
 * Application Entry Point
 *
 * Initializes and starts the Elysia API server using bootstrap.
 */

import { start, bootstrap } from './bootstrap';

// Export app for testing
export const app = await bootstrap();

if (import.meta.main) {
  start().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}
