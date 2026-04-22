/**
 * Application Entry Point
 *
 * Initializes and starts the Elysia API server.
 */

import { bootstrap, start } from './bootstrap';

export const app = await bootstrap();
export { bootstrap, start };

if (import.meta.main) {
  start().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

