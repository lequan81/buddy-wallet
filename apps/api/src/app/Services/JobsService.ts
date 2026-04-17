import { injectable } from 'tsyringe';
import { randomUUIDv7 } from 'bun';
import { importCache, isRedisAvailable, getClient } from '@plugins/redis';
import { STORAGE_CONFIG, BACKEND_CONSTANTS } from '@repo/config';
import { logger } from '@repo/logger';
import { sanitizeFileName, toOptional } from '@repo/utils';
import type { WorkerJobPayload, JobType, JobPayload } from '@repo/types';

const importObjectPrefix = STORAGE_CONFIG.IMPORT_OBJECT_PREFIX.replace(/^\/+|\/+$/g, '') || 'imports';

const s3Client = new Bun.S3Client({
  endpoint: toOptional(STORAGE_CONFIG.ENDPOINT),
  region: toOptional(STORAGE_CONFIG.REGION),
  bucket: toOptional(STORAGE_CONFIG.BUCKET),
  accessKeyId: toOptional(STORAGE_CONFIG.ACCESS_KEY_ID),
  secretAccessKey: toOptional(STORAGE_CONFIG.SECRET_ACCESS_KEY),
  virtualHostedStyle: !STORAGE_CONFIG.FORCE_PATH_STYLE
});

const isS3Configured = (): boolean =>
  Boolean(
    STORAGE_CONFIG.BUCKET &&
      STORAGE_CONFIG.ENDPOINT &&
      STORAGE_CONFIG.REGION &&
      STORAGE_CONFIG.ACCESS_KEY_ID &&
      STORAGE_CONFIG.SECRET_ACCESS_KEY
  );

@injectable()
export class JobsService {
  private jobTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private clearJobTimeout(jobId: string) {
    const timeout = this.jobTimeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.jobTimeouts.delete(jobId);
    }
  }

  async addJob(type: JobType, payload: JobPayload): Promise<string> {
    const jobId = randomUUIDv7('base64url');
    const fileName = sanitizeFileName(payload.file ? payload.file.name : payload.fileName);
    let storageKey: string | undefined;

    if (payload.file) {
      if (isS3Configured()) {
        storageKey = `${importObjectPrefix}/${jobId}-${fileName}`;
        await s3Client.write(storageKey, payload.file);

        const file = s3Client.file(storageKey);
        if (!(await file.exists())) {
          throw new Error(
            `Critical I/O Error: Failed to persist upload object at key ${storageKey}`
          );
        }
      } else {
        logger.error('[JobsService] Storage Unavailable: S3 is not configured and local fallback is disabled.');
        throw new Error('Import service is temporarily unavailable (Storage not configured). Please contact support.');
      }
    }

    // NORMAL FLOW: Always Push to Redis Queue for Background Worker

    const workerPayload: WorkerJobPayload = {
      type,
      jobId,
      userId: payload.userId,
      fileName: fileName || 'unnamed',
      config: payload.config as { mapping: import('@repo/types').ColumnMapping; startRow: number } | undefined,
      previewLogId: payload.previewLogId,
      storageKey
    };

    if (isRedisAvailable()) {
      await importCache.setProgress(jobId, { status: 'pending', current: 0, total: 0 });

      const redis = getClient();
      if (redis) {
        // Store job metadata for cancel/status lookups
        const userId_str = typeof payload.userId === 'string' ? payload.userId : payload.userId.id;
        await Promise.all([
          redis.send('HSET', [
            `job:${jobId}`,
            'status',
            'pending',
            'type',
            type,
            'userId',
            userId_str,
            'fileName',
            fileName || '',
            'createdAt',
            Date.now().toString(),
            'storageKey',
            storageKey || ''
          ]),
          redis.send('EXPIRE', [`job:${jobId}`, '3600']),
          redis.send('RPUSH', ['import_jobs', JSON.stringify(workerPayload)])
        ]);
        logger.info(`[JobsService] Enqueued job ${jobId} (Type: ${type}) to import_jobs queue.`);
      } else {
        logger.error(`[JobsService] Failed to enqueue job ${jobId}, redis client not ready.`);
      }
    } else {
      logger.error(`[JobsService] Cannot enqueue job ${jobId}, redis is not available.`);
    }

    const timeoutMs = BACKEND_CONSTANTS.JOBS.TIMEOUT_MS || 600000;
    const timeout = setTimeout(
      () => {
        logger.warn(`[JobsService] Job ${jobId} timed out after ${timeoutMs / 1000 / 60}m.`);
        if (isRedisAvailable()) {
          importCache
            .setProgress(jobId, {
              status: 'failed',
              errors: [`Job timed out after ${timeoutMs / 1000 / 60} minutes`],
              current: 0,
              total: 0
            })
            .catch((err) =>
              logger.error('Redis update failed for timeout', { error: String(err) })
            );
        }
        this.jobTimeouts.delete(jobId);
      },
      timeoutMs
    );

    this.jobTimeouts.set(jobId, timeout);

    return jobId;
  }

  /**
   * Cancel a pending job.
   * Verifies ownership, removes from queue, and cleans up uploaded object.
   */
  async cancelJob(jobId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    if (!isRedisAvailable()) {
      return { success: false, error: 'Queue not available' };
    }

    const redis = getClient();
    if (!redis) return { success: false, error: 'Redis client not ready' };

    // Verify ownership via job metadata hash
    const meta = (await redis.send('HGETALL', [`job:${jobId}`])) as string[] | null;
    if (!meta || meta.length === 0) {
      return { success: false, error: 'Job not found' };
    }

    // Parse HGETALL flat array [key1, val1, key2, val2, ...] into object
    const metaObj: Record<string, string> = {};
    for (let i = 0; i < meta.length; i += 2) {
      metaObj[meta[i]] = meta[i + 1];
    }

    if (metaObj.userId !== userId) {
      return { success: false, error: 'Not authorized to cancel this job' };
    }
    if (metaObj.status !== 'pending') {
      return { success: false, error: `Cannot cancel job in '${metaObj.status}' state` };
    }

    // Remove from queue (LRANGE + find + LREM)
    const queueItems = (await redis.send('LRANGE', ['import_jobs', '0', '-1'])) as string[];
    for (const item of queueItems) {
      try {
        if (JSON.parse(item).jobId === jobId) {
          await redis.send('LREM', ['import_jobs', '1', item]);
          break;
        }
      } catch {
        continue;
      }
    }

    // Update status
    await Promise.all([
      redis.send('HSET', [`job:${jobId}`, 'status', 'cancelled']),
      importCache.setProgress(jobId, {
        status: 'failed',
        current: 0,
        total: 0,
        errors: ['Cancelled by user']
      })
    ]);

    // Clean up uploaded object
    if (metaObj.storageKey) {
      await s3Client.delete(metaObj.storageKey).catch((error: unknown) => {
        logger.warn(`[JobsService] Failed to delete object for cancelled job ${jobId}`, {
          error: String(error),
          storageKey: metaObj.storageKey
        });
      });
    }

    this.clearJobTimeout(jobId);
    logger.info(`[JobsService] Job ${jobId} cancelled by user ${userId}`);
    return { success: true };
  }

  /**
   * Get queue status (pending count).
   */
  async getQueueStatus(): Promise<{ pending: number }> {
    if (!isRedisAvailable()) return { pending: 0 };
    const redis = getClient();
    if (!redis) return { pending: 0 };
    const len = (await redis.send('LLEN', ['import_jobs'])) as number;
    return { pending: len };
  }
}
