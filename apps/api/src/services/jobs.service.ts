import { randomUUIDv7 } from 'bun';
import { importCache, isRedisAvailable, getClient } from '../plugins/redis';
import { MAX_DIRECT_PROCESS_SIZE_BYTES } from '@repo/config';
import { logger } from '@repo/logger';

type JobType = 'preview' | 'import';

import type { JobPayload } from '../types';

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
    const isSmallFile = payload.file && payload.file.size <= MAX_DIRECT_PROCESS_SIZE_BYTES;

    // Direct Processing for previews and small import files
    if (type === 'preview' || (type === 'import' && isSmallFile)) {
      logger.info(
        `[JobsService] Starting in-process job: ${jobId} (Type: ${type}, File: ${fileName})`
      );

      if (isRedisAvailable()) {
        await importCache.setProgress(jobId, { status: 'pending', current: 0, total: 0 });
      }

      this.runInProcessJob(jobId, type, payload).catch((err) => {
        logger.error(`[JobsService] Unhandled error in in-process job ${jobId}:`, {
          error: String(err)
        });
      });

      return jobId;
    }

    // NORMAL FLOW: Push to Redis Queue for Background Worker

    // Convert File to base64 or save the arrayBuffer to temp disk.
    // Wait, the new plan says to save file to /tmp/uploads
    let tempFilePath: string | undefined;
    if (payload.file) {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const { UPLOAD_TMP_DIR } = await import('@repo/config');

      await fs.mkdir(UPLOAD_TMP_DIR, { recursive: true });
      tempFilePath = path.join(UPLOAD_TMP_DIR, `${jobId}-${fileName}`);
      await fs.writeFile(tempFilePath, Buffer.from(await payload.file.arrayBuffer()));
    }

    const workerPayload = {
      type,
      jobId,
      userId: payload.userId,
      fileName,
      config: payload.config,
      previewLogId: payload.previewLogId,
      tempFilePath
    };

    if (isRedisAvailable()) {
      await importCache.setProgress(jobId, { status: 'pending', current: 0, total: 0 });

      const redis = getClient();
      if (redis) {
        await redis.rpush('import_jobs', JSON.stringify(workerPayload));
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

  private async runInProcessJob(jobId: string, type: JobType, payload: JobPayload) {
    try {
      const { ImportService } = await import('./import.service');
      const { db } = await import('@repo/db');
      const service = new ImportService(db);

      if (!payload.file) throw new Error('No file provided for job');

      const timeoutMs = type === 'preview' ? 60 * 1000 : 3 * 60 * 1000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Job timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      let processingPromise;
      if (type === 'preview') {
        const userId = typeof payload.userId === 'string' ? payload.userId : payload.userId.id;
        processingPromise = service.previewFile(payload.file, userId, jobId);
      } else {
        const uId =
          typeof payload.userId === 'string'
            ? { id: payload.userId, phoneNumber: null }
            : payload.userId;
        const typeCastConfig = payload.config as import('../types').ImportConfig;
        const typeCastUid = uId as import('../types').CurrentUser;
        processingPromise = service.importDebts(
          payload.file,
          typeCastConfig,
          typeCastUid,
          payload.previewLogId,
          jobId
        );
      }

      const result = (await Promise.race([processingPromise, timeoutPromise])) as {
        success: boolean;
      };

      logger.info(`[JobsService] In-process job ${jobId} finished. Success: ${result.success}`);
    } catch (error) {
      logger.error(`[JobsService] In-process job ${jobId} failed:`, { error: String(error) });
      if (isRedisAvailable()) {
        await importCache.setProgress(jobId, {
          status: 'failed',
          errors: [error instanceof Error ? error.message : String(error)],
          current: 0,
          total: 0
        });
      }
    }
  }
}
