import { env } from '../env';

/**
 * Storage Configuration (S3-only)
 */
export const STORAGE_CONFIG = {
  ENDPOINT: env.string('S3_ENDPOINT', ''),
  REGION: env.string('S3_REGION', ''),
  BUCKET: env.string('S3_BUCKET', ''),
  ACCESS_KEY_ID: env.string('S3_ACCESS_KEY_ID', ''),
  SECRET_ACCESS_KEY: env.string('S3_SECRET_ACCESS_KEY', ''),
  PUBLIC_BASE_URL: env.string('S3_PUBLIC_BASE_URL', ''),
  FORCE_PATH_STYLE: env.bool('S3_FORCE_PATH_STYLE', true),
  IMPORT_OBJECT_PREFIX: env.string('S3_IMPORT_PREFIX', 'imports'),
} as const;
