import { STORAGE_CONFIG } from '@repo/config';
import type { WorkerJobPayload } from '@repo/types';

const IMPORT_OBJECT_PREFIX =
  STORAGE_CONFIG.IMPORT_OBJECT_PREFIX.replace(/^\/+|\/+$/g, '') || 'imports';

/**
 * Validates the job payload structure and type.
 */
export function validatePayload(raw: unknown): raw is WorkerJobPayload {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;
  const hasStorageKey =
    typeof p.storageKey === 'string' && p.storageKey.startsWith(`${IMPORT_OBJECT_PREFIX}/`);
  
  // Storage key is now MANDATORY for our refactored worker
  return (
    typeof p.jobId === 'string' &&
    typeof p.fileName === 'string' &&
    hasStorageKey &&
    (p.type === 'preview' || p.type === 'import') &&
    (typeof p.userId === 'string' || (typeof p.userId === 'object' && p.userId !== null))
  );
}

/**
 * Quick check if S3 configuration is present.
 */
export function isStorageConfigured(): boolean {
  return Boolean(
    STORAGE_CONFIG.BUCKET &&
      STORAGE_CONFIG.ENDPOINT &&
      STORAGE_CONFIG.REGION &&
      STORAGE_CONFIG.ACCESS_KEY_ID &&
      STORAGE_CONFIG.SECRET_ACCESS_KEY
  );
}
