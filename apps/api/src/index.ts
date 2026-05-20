/**
 * Application Entry Point
 *
 * Initializes and starts the Elysia API server using bootstrap.
 */

import { start, bootstrap } from './bootstrap';
import { logger } from '@repo/logger';

// Re-export types for Eden Treaty clients
export type { createApp } from './bootstrap';
export type App = ReturnType<typeof import('./bootstrap').createApp>;

// Export app for testing
export const app = await bootstrap();

if (import.meta.main) {
  const startWithRetry = async () => {
    let attempt = 0;

    while (true) {
      try {
        await start();
        return;
      } catch (error) {
        attempt++;
        const delayMs = Math.min(1000 * Math.pow(2, Math.min(attempt - 1, 5)), 30000);
        logger.error('Failed to start application, retrying', {
          attempt,
          delayMs,
          error: String(error)
        });
        await Bun.sleep(delayMs);
      }
    }
  };

  void startWithRetry();
}
