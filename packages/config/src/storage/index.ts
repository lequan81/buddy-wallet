import { optionalEnv, getEnvBool } from '../env';

/**
 * Storage Configuration (S3-only)
 */
export const STORAGE_CONFIG = {
  ENDPOINT: optionalEnv('S3_ENDPOINT', ''),
  REGION: optionalEnv('S3_REGION', ''),
  BUCKET: optionalEnv('S3_BUCKET', ''),
  ACCESS_KEY_ID: optionalEnv('S3_ACCESS_KEY_ID', ''),
  SECRET_ACCESS_KEY: optionalEnv('S3_SECRET_ACCESS_KEY', ''),
  PUBLIC_BASE_URL: optionalEnv('S3_PUBLIC_BASE_URL', ''),
  FORCE_PATH_STYLE: getEnvBool('S3_FORCE_PATH_STYLE', true),
  IMPORT_OBJECT_PREFIX: optionalEnv('S3_IMPORT_PREFIX', 'imports'),
} as const;
