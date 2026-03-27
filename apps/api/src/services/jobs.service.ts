import { randomUUIDv7 } from 'bun';
import { importCache, isRedisAvailable, getClient } from '../plugins/redis';
import { logger } from '@repo/logger';
import type { WorkerJobPayload, JobType, JobPayload } from '@repo/types';

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
    const fileName = payload.file ? payload.file.name : payload.fileName;

    // FIX ENOENT:
    // Elysia (via Bun) mounts incoming multipart File uploads onto the volatile OS Temp directory.
    // The *instant* this HTTP handler returns a Response, Bun deletes that `bun-xxxx` OS file natively.
    // Because JobsService launches background tracking tasks, we MUST eagerly detach the file
    // into a stable RAM-based `<Blob>` synchronously before yielding back to the HTTP router!
    let tempFilePath: string | undefined;

    if (payload.file) {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const { UPLOAD_TMP_DIR } = await import('@repo/config');

      try {
        await fs.mkdir(UPLOAD_TMP_DIR, { recursive: true });
      } catch (e) {
        if ((e as { code?: string }).code !== 'EEXIST') throw e;
      }

      tempFilePath = path.join(UPLOAD_TMP_DIR, `${jobId}-${fileName}`);

      // Persist the file safely to the stable local tmp directory using Bun's native optimized I/O
      await Bun.write(tempFilePath, payload.file);

      // Eagerly verify the file was actually saved to disk
      const stats = await fs.stat(tempFilePath).catch(() => null);
      if (!stats) {
        throw new Error(`Critical I/O Error: Failed to flush upload to disk at ${tempFilePath}`);
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
      tempFilePath
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
            'tempFilePath',
            tempFilePath || ''
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

    const timeout = setTimeout(
      () => {
        logger.warn(`[JobsService] Job ${jobId} timed out after 10m.`);
        if (isRedisAvailable()) {
          importCache
            .setProgress(jobId, {
              status: 'failed',
              errors: ['Job timed out after 10 minutes'],
              current: 0,
              total: 0
            })
            .catch((err) =>
              logger.error('Redis update failed for timeout', { error: String(err) })
            );
        }
        this.jobTimeouts.delete(jobId);
      },
      10 * 60 * 1000
    );

    this.jobTimeouts.set(jobId, timeout);

    return jobId;
  }

  /**
   * Cancel a pending job.
   * Verifies ownership, removes from queue, cleans up temp file.
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

    // Clean up temp file
    if (metaObj.tempFilePath) {
      const fs = await import('node:fs/promises');
      await fs.unlink(metaObj.tempFilePath).catch(() => {});
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
