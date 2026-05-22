import { env } from '../env';

/**
 * Storage Configuration (S3-only)
 */
export const STORAGE_CONFIG = {
  ENDPOINT: env.string('S3_ENDPOINT', ''),
  REGION: env.string('S3_REGION', ''),
  BUCKET: env.string('S3_BUCKET', ''),
  ACCESS_KEY: env.string('S3_ACCESS_KEY', ''),
  SECRET_KEY: env.string('S3_SECRET_KEY', ''),
  PUBLIC_BASE_URL: env.string('S3_PUBLIC_BASE_URL', ''),
  FORCE_PATH_STYLE: env.bool('S3_FORCE_PATH_STYLE', true),
  SSL: env.bool('S3_SSL', false),
  IMPORT_OBJECT_PREFIX: env.string('S3_IMPORT_PREFIX', 'imports'),
} as const;

/**
 * Build S3 endpoint URL with auto-protocol detection.
 *
 * - If endpoint already contains a protocol (http:// or https://), return as-is.
 * - If endpoint is a bare hostname, prepend http:// or https:// based on S3_SSL.
 */
export function buildS3Endpoint(endpoint: string, ssl: boolean): string {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  return `${ssl ? 'https' : 'http'}://${endpoint}`;
}

export const PROOF_IMAGE_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
  PROCESSING: {
    maxWidth: 1920,
    maxHeight: 1080,
    displayQuality: 80,
    downloadQuality: 100
  }
} as const;

