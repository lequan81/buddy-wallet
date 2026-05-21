/**
 * Storage Provider
 * 
 * Exports S3 storage instances for file operations.
 * In ElysiaJS FP, we export instances directly without DI container.
 */

import { STORAGE_CONFIG, buildS3Endpoint } from '@repo/config';
import { toOptional } from '@repo/utils';
import { createStorageService } from '@/modules/storage/services/s3.service';

// Build endpoint with auto-protocol detection
const resolvedEndpoint = buildS3Endpoint(STORAGE_CONFIG.ENDPOINT, STORAGE_CONFIG.SSL);

// Global S3 Client
const globalS3Client = new Bun.S3Client({
  endpoint: toOptional(resolvedEndpoint),
  region: toOptional(STORAGE_CONFIG.REGION),
  bucket: toOptional(STORAGE_CONFIG.BUCKET),
  accessKeyId: toOptional(STORAGE_CONFIG.ACCESS_KEY),
  secretAccessKey: toOptional(STORAGE_CONFIG.SECRET_KEY),
  virtualHostedStyle: !STORAGE_CONFIG.FORCE_PATH_STYLE
});

// Storage instances
export const uploadStorage = createStorageService(
  globalS3Client,
  'uploads',
  STORAGE_CONFIG.BUCKET!,
  toOptional(STORAGE_CONFIG.PUBLIC_BASE_URL)
);

export const proofStorage = createStorageService(
  globalS3Client,
  'proofs',
  STORAGE_CONFIG.BUCKET!,
  toOptional(STORAGE_CONFIG.PUBLIC_BASE_URL)
);

/**
 * Import JSON storage — stores pre-parsed spreadsheet data as JSON
 * for fast re-mapping without re-processing binary Excel/CSV files.
 *
 * Key pattern: imports/json/{previewId}.json
 */
export const importStorage = createStorageService(
  globalS3Client,
  'imports/json',
  STORAGE_CONFIG.BUCKET!,
  toOptional(STORAGE_CONFIG.PUBLIC_BASE_URL)
);

/**
 * Raw Import storage — stores uploaded Excel/CSV files for asynchronous
 * processing by the worker.
 *
 * Key pattern: imports/raw/{previewId}.xlsx
 */
export const rawImportStorage = createStorageService(
  globalS3Client,
  'imports/raw',
  STORAGE_CONFIG.BUCKET!,
  toOptional(STORAGE_CONFIG.PUBLIC_BASE_URL)
);

/**
 * Check if S3 storage is available and healthy by doing a fast HEAD check
 */
export async function isS3Available(): Promise<boolean> {
  try {
    const file = globalS3Client.file('_health_check_nonexistent');
    
    // Generous promise race timeout (3000ms) to accommodate slower connections.
    // Both branches resolve and never reject, eliminating any unhandled promise rejections.
    let timeoutId: any;
    const existsPromise = file.exists();
    const timeoutPromise = new Promise<boolean>((resolve) => {
      timeoutId = setTimeout(() => resolve(false), 3000);
    });

    const result = await Promise.race([
      existsPromise.then(() => true).catch(() => false),
      timeoutPromise
    ]);

    clearTimeout(timeoutId);
    return result;
  } catch (_err) {
    return false;
  }
}
