/**
 * Import Worker - Background Job Processor
 *
 * Runs as a separate Bun process in apps/worker workspace.
 */
import { logger } from '@repo/logger';
import { BACKEND_CONSTANTS } from '@repo/config';
import { initRedis, getRedis } from './redis';
import { validatePayload, isStorageConfigured } from './utils';
import { processImportJob } from './jobs/import.job';

// ── Startup & Configuration ────────────────────────────────
const KILL_TIMEOUT_MS = BACKEND_CONSTANTS.WORKER.KILL_TIMEOUT_MS || 300000;

setTimeout(() => {
  logger.error(`[Worker] Kill timeout reached (${KILL_TIMEOUT_MS / 1000 / 60} min)`);
  process.exit(1);
}, KILL_TIMEOUT_MS);

// ── Main Queue Loop ────────────────────────────────────────
async function main() {
  logger.info('[Worker] Import Worker starting...');

  if (!isStorageConfigured()) {
    logger.warn('[Worker] S3 storage not fully configured. Job processing will fail unless storage is available.');
  }

  const redisReady = await initRedis();
  if (!redisReady) {
    logger.error('[Worker] Fatal: Redis unavailable after retries');
    process.exit(1);
  }

  logger.info('[Worker] Listening on import_jobs queue...');

  let consecutiveErrors = 0;

  while (true) {
    try {
      const redis = getRedis();
      const result = await redis.blpop('import_jobs', 30);

      if (result && result.length === 2) {
        consecutiveErrors = 0;
        const [, payloadString] = result;

        let parsed: unknown;
        try {
          parsed = JSON.parse(payloadString);
        } catch {
          logger.error('[Worker] Received invalid JSON payload', { raw: payloadString.slice(0, 100) });
          continue;
        }

        if (!validatePayload(parsed)) {
          logger.error('[Worker] Received invalid/incompatible payload', { 
            jobId: (parsed as any)?.jobId 
          });
          continue;
        }

        logger.info(`[Worker] Processing job: ${parsed.jobId} (${parsed.type})`);
        await processImportJob(parsed);
      }
    } catch (error) {
      const errorStr = String(error);
      const isConnectionError = errorStr.includes('Connection') || errorStr.includes('not connected');

      if (isConnectionError) {
        logger.error('[Worker] Redis connection lost, attempting reconnect...');
        const reconnected = await initRedis();
        if (!reconnected) {
          logger.error('[Worker] Reconnect failed, exiting');
          process.exit(1);
        }
        consecutiveErrors = 0;
        continue;
      }

      consecutiveErrors++;
      const baseDelay = BACKEND_CONSTANTS.WORKER.BACKOFF_BASE_MS || 5000;
      const maxDelay = BACKEND_CONSTANTS.WORKER.BACKOFF_MAX_MS || 60000;
      const backoff = Math.min(baseDelay * Math.pow(2, consecutiveErrors - 1), maxDelay);
      
      logger.warn(`[Worker] Unexpected error, retrying in ${Math.round(backoff / 1000)}s`, {
        error: errorStr,
        attempt: consecutiveErrors
      });
      await Bun.sleep(backoff);
    }
  }
}

main().catch((err) => {
  logger.error('[Worker] Fatal error', { error: String(err) });
  process.exit(1);
});
