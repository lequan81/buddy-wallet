import { randomUUIDv7 } from 'bun';

type JobType = 'preview' | 'import';

interface JobPayload {
  file?: File;
  userId: string | { id: string; phoneNumber: string | null };
  fileName?: string;
  config?: any;
  previewLogId?: string;
}

export class JobsService {
  private activeWorkers: Map<string, Worker> = new Map();
  private maxConcurrency = 5;

  /**
   * Add a new background job
   */
  async addJob(type: JobType, payload: JobPayload): Promise<string> {
    if (this.activeWorkers.size >= this.maxConcurrency) {
      throw new Error('System is busy, please try again later.');
    }

    const jobId = randomUUIDv7('base64url');
    const worker = new Worker(new URL('../workers/import.worker.ts', import.meta.url).href);

    // Prepare payload
    // We need to convert File to ArrayBuffer because File object is not clonable/transferable in all contexts reliably,
    // although Bun might support it, ArrayBuffer is safest for zero-copy transfer.
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

    // Store worker reference
    this.activeWorkers.set(jobId, worker);

    // Handle worker messages
    worker.onmessage = (event) => {
      const { jobId, success, result, error } = event.data;

      // We can log completion here if needed, but the worker already updates Redis/DB
      // So we mainly just need to cleanup the worker
      this.cleanupWorker(jobId);
    };

    worker.onerror = (error) => {
      console.error(`[JobsService] Worker error for job ${jobId}:`, error);
      this.cleanupWorker(jobId);
    };

    // Start worker
    // Transfer arrayBuffer to worker (zero-copy)
    if (arrayBuffer) {
      worker.postMessage(workerPayload, [arrayBuffer]);
    } else {
      worker.postMessage(workerPayload);
    }

    return jobId;
  }

  private cleanupWorker(jobId: string) {
    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      worker.terminate();
      this.activeWorkers.delete(jobId);
    }
  }
}
