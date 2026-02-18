import { db } from '@repo/db';
import { ImportService } from '../services/import.service';
import { initRedis } from '../plugins/redis/connection';

// Initialize Redis for this worker thread
// We await this at the top level to ensure readiness
await initRedis();

// Instantiate service with thread-local DB connection
const service = new ImportService(db);

declare var self: Worker;

self.onmessage = async (event: MessageEvent) => {
  const { type, jobId, arrayBuffer, fileName, userId, config, previewLogId } = event.data;

  try {
    // Reconstruct File object from ArrayBuffer
    // Note: 'File' is available in Bun's worker scope
    const file = new File([arrayBuffer], fileName, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    if (type === 'preview') {
      const result = await service.previewFile(file, userId, jobId);
      self.postMessage({ jobId, type: 'preview', success: true, result });
    } else if (type === 'import') {
      const result = await service.importDebts(file, config, userId, previewLogId, jobId);
      self.postMessage({ jobId, type: 'import', success: true, result });
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      jobId,
      type,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
