/**
 * Storage Provider
 * 
 * Exports S3 storage instances for file operations.
 * In ElysiaJS FP, we export instances directly without DI container.
 */

import { STORAGE_CONFIG } from '@repo/config';
import { toOptional } from '@repo/utils';
import { createStorageService } from '@/modules/storage/services/s3.service';

// Global S3 Client
const globalS3Client = new Bun.S3Client({
  endpoint: toOptional(STORAGE_CONFIG.ENDPOINT),
  region: toOptional(STORAGE_CONFIG.REGION),
  bucket: toOptional(STORAGE_CONFIG.BUCKET),
  accessKeyId: toOptional(STORAGE_CONFIG.ACCESS_KEY_ID),
  secretAccessKey: toOptional(STORAGE_CONFIG.SECRET_ACCESS_KEY),
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
