/// <reference types="node" />
/**
 * Prune Worker
 *
 * Standalone script for database cleanup tasks.
 * Run via: bun run scripts/prune-worker/index.ts
 *
 * For production deployment, use the buddy-cleanup.timer systemd unit
 * to run this script on a schedule (e.g., daily).
 */
import { CleanupService } from '../../src/services/cleanup.service';
import { logger } from '@repo/logger';

async function main() {
  logger.app('[Prune Worker] Starting cleanup...');
  const startTime = Date.now();

  try {
    await CleanupService.runAll();
  } catch (error) {
    logger.error('[Prune Worker] Error during cleanup:', { error: String(error) });
    process.exit(1);
  }

  const duration = Date.now() - startTime;
  logger.app(`[Prune Worker] Cleanup completed in ${duration}ms`);
  process.exit(0);
}

main();
