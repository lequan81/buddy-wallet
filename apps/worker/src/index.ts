/**
 * Background Worker - Job Processor
 *
 * Runs as a separate Bun process in apps/worker workspace.
 * Processes jobs from Redis queues:
 *   - bw:queue:imports: Excel import processing
 *   - bw:queue:push_notifications: Web push delivery
 *   - Outbox event dispatch (polling)
 */
import { logger } from '@repo/logger';
import { BACKEND_CONSTANTS } from '@repo/config';
import { initRedis, getRedis, closeRedis } from './redis';
import { validatePayload, isStorageConfigured } from './utils';
import { processImportJob } from './jobs/import.job';
import { dispatchOutboxBatch } from './jobs/outbox-dispatch.job';
import { processPushJob, type PushJobPayload } from './jobs/push-notification.job';
import { processImageJob } from './jobs/image-processing.job';
import type { WorkerJobPayload } from '@repo/types';

// ── Startup & Configuration ────────────────────────────────
const KILL_TIMEOUT_MS = BACKEND_CONSTANTS.WORKER.KILL_TIMEOUT_MS || 300000;
const OUTBOX_BATCH_SIZE = Number.parseInt(Bun.env.OUTBOX_BATCH_SIZE ?? '25', 10);
const DRAIN_TIMEOUT_MS = Number.parseInt(Bun.env.WORKER_DRAIN_TIMEOUT_MS ?? '10000', 10);
let shuttingDown = false;
let inFlightImportJobs = 0;
let inFlightOutboxBatches = 0;
let inFlightPushJobs = 0;
let inFlightImageJobs = 0;

function getInFlightCount(): number {
  return inFlightImportJobs + inFlightOutboxBatches + inFlightPushJobs + inFlightImageJobs;
}

async function waitForDrain(): Promise<void> {
  const startedAt = Date.now();

  while (getInFlightCount() > 0 && Date.now() - startedAt < DRAIN_TIMEOUT_MS) {
    await Bun.sleep(200);
  }
}

const killTimeout = setTimeout(() => {
  logger.error(`[Worker] Kill timeout reached (${KILL_TIMEOUT_MS / 1000 / 60} min)`);
  process.exit(0);
}, KILL_TIMEOUT_MS);

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  clearTimeout(killTimeout);
  logger.info(`[Worker] Shutdown signal received: ${signal}`);

  try {
    await waitForDrain();

    if (getInFlightCount() > 0) {
      logger.warn('[Worker] Drain timeout reached, forcing shutdown', {
        inFlightImportJobs,
        inFlightOutboxBatches,
        inFlightPushJobs,
        inFlightImageJobs
      });
    }

    closeRedis();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// ── Main Queue Loop ────────────────────────────────────────
async function main() {
  logger.info('[Worker] Background Worker starting...');

  if (!isStorageConfigured()) {
    logger.warn('[Worker] S3 storage not fully configured. Job processing will fail unless storage is available.');
  }

  const redisReady = await initRedis();
  if (!redisReady) {
    logger.warn('[Worker] Redis unavailable after initial retries — entering degraded mode (will keep retrying)');
  }

  logger.info('[Worker] Listening on queues: bw:queue:imports, bw:queue:push_notifications, bw:queue:image_processing');

  let consecutiveErrors = 0;

  while (!shuttingDown) {
    try {
      const redis = getRedis();

      // ── Import Jobs ──────────────────────────────────────
      const importResult = await redis.blpop('bw:queue:imports', 5);

      if (importResult && importResult.length === 2) {
        consecutiveErrors = 0;
        const [, payloadString] = importResult;

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

        logger.info(`[Worker] Processing import job: ${parsed.jobId} (${parsed.type})`);
        inFlightImportJobs++;
        try {
          await processImportJob(parsed);
        } finally {
          inFlightImportJobs = Math.max(0, inFlightImportJobs - 1);
        }
        continue;
      }

      // ── Push Notification Jobs ───────────────────────────
      const pushResult = await redis.blpop('bw:queue:push_notifications', 5);

      if (pushResult && pushResult.length === 2) {
        consecutiveErrors = 0;
        const [, pushPayloadString] = pushResult;

        let pushParsed: PushJobPayload;
        try {
          pushParsed = JSON.parse(pushPayloadString) as PushJobPayload;
        } catch {
          logger.error('[Worker] Received invalid push JSON payload', { raw: pushPayloadString.slice(0, 100) });
          continue;
        }

        if (!pushParsed.userId || !pushParsed.payload?.title) {
          logger.error('[Worker] Invalid push job payload', { userId: pushParsed.userId });
          continue;
        }

        logger.debug(`[Worker] Processing push job for user: ${pushParsed.userId}`);
        inFlightPushJobs++;
        try {
          await processPushJob(pushParsed);
        } finally {
          inFlightPushJobs = Math.max(0, inFlightPushJobs - 1);
        }
        continue;
      }

      // ── Image Processing Jobs ─────────────────────────────
      const imageResult = await redis.blpop('bw:queue:image_processing', 5);

      if (imageResult && imageResult.length === 2) {
        consecutiveErrors = 0;
        const [, imagePayloadString] = imageResult;

        let imageParsed: WorkerJobPayload;
        try {
          imageParsed = JSON.parse(imagePayloadString) as WorkerJobPayload;
        } catch {
          logger.error('[Worker] Received invalid image JSON payload', { raw: imagePayloadString.slice(0, 100) });
          continue;
        }

        if (!imageParsed.jobId || !imageParsed.imageType) {
          logger.error('[Worker] Invalid image job payload', { jobId: imageParsed.jobId, imageType: imageParsed.imageType });
          continue;
        }

        logger.info(`[Worker] Processing image job: ${imageParsed.jobId} (${imageParsed.imageType})`);
        inFlightImageJobs++;
        try {
          await processImageJob(imageParsed);
        } finally {
          inFlightImageJobs = Math.max(0, inFlightImageJobs - 1);
        }
        continue;
      }

      // ── Outbox Dispatch (polling fallback) ───────────────
      inFlightOutboxBatches++;
      const outbox = await dispatchOutboxBatch(OUTBOX_BATCH_SIZE).finally(() => {
        inFlightOutboxBatches = Math.max(0, inFlightOutboxBatches - 1);
      });
      if (outbox.scanned > 0) {
        logger.info('[Worker] Outbox batch processed', {
          scanned: outbox.scanned,
          published: outbox.published,
          retried: outbox.retried,
          failed: outbox.failed
        });
      }
    } catch (error) {
      const errorStr = String(error);
      const isConnectionError = errorStr.includes('Connection') || errorStr.includes('not connected');

      if (isConnectionError) {
        logger.error('[Worker] Redis connection lost, attempting reconnect...');
        const reconnected = await initRedis();
        if (!reconnected) {
          logger.warn('[Worker] Reconnect failed, will retry in 30s');
          await Bun.sleep(30_000);
        } else {
          consecutiveErrors = 0;
        }
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
  process.exit(shuttingDown ? 0 : 1);
});
