/// <reference types="node" />
/**
 * Cleanup Script
 *
 * Standalone Bun script that runs all cleanup tasks.
 * For use with systemd timer in production (Debian 13).
 *
 * Usage:
 *   bun run apps/api/scripts/cleanup/index.ts
 */
import { CleanupService } from '../../src/services/cleanup.service';
import { logger } from '@repo/logger';

async function main() {
  logger.app('[Cleanup] Starting all cleanup tasks...');
  const startTime = Date.now();

  try {
    await CleanupService.runAll();
  } catch (error) {
    logger.error('[Cleanup] Error during cleanup:', { error: String(error) });
    process.exit(1);
  }

  const duration = Date.now() - startTime;
  logger.app(`[Cleanup] All tasks completed in ${duration}ms`);
  process.exit(0);
}

main();
