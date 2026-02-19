import { randomUUIDv7 } from 'bun';
import { importCache, isRedisAvailable } from '../plugins/redis';

type JobType = 'preview' | 'import';

import type { JobPayload } from '../types';

export class JobsService {
  private activeWorkers: Map<string, Worker> = new Map();
  private maxConcurrency = 5;

  /**
   * Add a new background job
   */
  /*
   * Add a new background job
   */
  async addJob(type: JobType, payload: JobPayload): Promise<string> {
    const jobId = randomUUIDv7('base64url');

    // OPTIMIZATION: Run 'preview' jobs in-process (Main Thread)
    // This avoids the massive overhead (45s+) of spawning a new Worker for small files
    if (type === 'preview') {
      console.log(
        `[JobsService] Starting in-process preview job: ${jobId} for file: ${payload.fileName}`
      );

      // Initialize Redis immediately to prevent 404s
      if (isRedisAvailable()) {
        await importCache.setProgress(jobId, {
          status: 'pending',
          current: 0,
          total: 0
        });
      }

      // Run async without awaiting (fire-and-forget from controller's perspective,
      // but we await internally to catch errors and update Redis)
      this.runInProcessPreview(jobId, payload).catch((err) => {
        console.error(`[JobsService] Unhandled error in in-process preview ${jobId}:`, err);
      });

      return jobId;
    }

    // NORMAL FLOW: Worker Thread for heavy imports
    if (this.activeWorkers.size >= this.maxConcurrency) {
      throw new Error('System is busy, please try again later.');
    }

    // Use a more robust way to resolve the worker path on Windows/Bun
    const workerPath = new URL('../workers/import.worker.ts', import.meta.url).href;
    console.log(`[JobsService] Spawning worker from: ${workerPath}`);

    // Track worker startup time
    const startTime = performance.now();
    const worker = new Worker(workerPath);

    // Prepare payload
    let arrayBuffer: ArrayBuffer | undefined;
    let fileName: string | undefined;

    if (payload.file) {
      arrayBuffer = await payload.file.arrayBuffer();
      fileName = payload.file.name;
    }

    const workerPayload = {
      type,
      jobId,
      userId: payload.userId,
      fileName: fileName || payload.fileName,
      config: payload.config,
      previewLogId: payload.previewLogId,
      arrayBuffer
    };

    // Prevent 404 by initializing status in Redis immediately
    if (isRedisAvailable()) {
      await importCache.setProgress(jobId, {
        status: 'pending',
        current: 0,
        total: 0
      });
    }

    // Store worker reference
    this.activeWorkers.set(jobId, worker);
    console.log(
      `[JobsService] Worker instantiated in ${(performance.now() - startTime).toFixed(2)}ms`
    );
    console.log(`[JobsService] Started worker job: ${jobId} (Type: ${type})`);

    // Handle worker messages
    worker.onmessage = async (event) => {
      const { jobId, success, error } = event.data;

      if (success) {
        console.log(`[JobsService] Job ${jobId} completed successfully.`);
      } else {
        console.error(`[JobsService] Job ${jobId} failed: ${error}`);
        // Ensure Redis is updated to failed if the worker reported failure
        if (isRedisAvailable()) {
          await importCache
            .setProgress(jobId, {
              status: 'failed',
              errors: [String(error)],
              current: 0,
              total: 0
            })
            .catch((e) => console.error('Redis update failed', e));
        }
      }

      this.cleanupWorker(jobId);
    };

    worker.onerror = (error) => {
      console.error(`[JobsService] Worker error for job ${jobId}:`, error);
      // CRITICAL: Update Redis so the job doesn't stay 'pending' or 'processing' forever
      if (isRedisAvailable()) {
        importCache
          .setProgress(jobId, {
            status: 'failed',
            errors: ['System: Worker crashed or failed to start: ' + String(error)],
            current: 0,
            total: 0
          })
          .catch((e) => console.error('Redis update failed', e));
      }
      this.cleanupWorker(jobId);
    };

    // Start worker
    if (arrayBuffer) {
      worker.postMessage(workerPayload, [arrayBuffer]);
    } else {
      worker.postMessage(workerPayload);
    }

    // Set fallback timeout for worker (10 minutes)
    setTimeout(
      () => {
        const activeWorker = this.activeWorkers.get(jobId);
        if (activeWorker) {
          console.warn(`[JobsService] Job ${jobId} timed out after 10m. Terminating...`);
          activeWorker.terminate();
          this.activeWorkers.delete(jobId);

          // Update Redis to failed state
          if (isRedisAvailable()) {
            importCache
              .setProgress(jobId, {
                status: 'failed',
                errors: ['Job timed out after 10 minutes'],
                current: 0,
                total: 0
              })
              .catch((err) => console.error('Failed to update Redis for timed out job', err));
          }
        }
      },
      10 * 60 * 1000
    );

    return jobId;
  }

  private async runInProcessPreview(jobId: string, payload: JobPayload) {
    try {
      // Import here to avoid circular dependencies
      const { ImportService } = await import('./import.service');
      const { db } = await import('@repo/db');
      const service = new ImportService(db);

      if (!payload.file) throw new Error('No file provided for preview');
      // cast userId as needed
      const userId = typeof payload.userId === 'string' ? payload.userId : payload.userId.id;

      // Wrap in timeout race (1 minute for preview)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Preview timed out after 1 minute')), 60 * 1000)
      );

      const processingPromise = service.previewFile(payload.file, userId, jobId);

      const result = (await Promise.race([processingPromise, timeoutPromise])) as {
        success: boolean;
      };

      console.log(`[JobsService] In-process preview ${jobId} finished. Success: ${result.success}`);
    } catch (error) {
      console.error(`[JobsService] In-process preview ${jobId} failed:`, error);

      // Update Redis to failed
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

  private cleanupWorker(jobId: string) {
    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      worker.terminate();
      this.activeWorkers.delete(jobId);
      console.log(`[JobsService] Worker ${jobId} terminated.`);
    }
  }
}
