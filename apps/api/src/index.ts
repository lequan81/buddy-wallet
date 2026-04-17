/**
 * Application Entry Point
 *
 * Initializes and starts the Elysia API server.
 */

import { start } from './bootstrap';

// Start the application
start().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
