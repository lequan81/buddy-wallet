/**
 * Prune Worker
 *
 * Standalone script for database cleanup tasks.
 * Run via: bun run scripts/prune-worker/index.ts
 *
 * For production deployment, use the buddy-cleanup.timer systemd unit
 * to run this script on a schedule (e.g., daily).
 */
import { CleanupService } from '@services/cleanup.service';

async function main() {
  console.log('[Prune Worker] Starting cleanup...');
  const startTime = Date.now();

  try {
    await CleanupService.runAll();
  } catch (error) {
    console.error('[Prune Worker] Error during cleanup:', error);
    process.exit(1);
  }

  const duration = Date.now() - startTime;
  console.log(`[Prune Worker] Cleanup completed in ${duration}ms`);
  process.exit(0);
}

main();
