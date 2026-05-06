/**
 * S3 Storage Service - Pure Functions
 * 
 * Following ElysiaJS functional programming principles:
 * - Pure functions only (no DI, no Elysia context)
 * - Input -> Process -> Output
 * - No side effects in service layer
 * - S3 client passed as parameter
 */

import { logger } from '@repo/logger';

const PATH_CONTROL_CHARS_REGEX = /[\0\x00-\x1F\x7F]/g;
const MULTI_SLASH_REGEX = /\/{2,}/g;
const PATH_TRAVERSAL_SEGMENT = '..';

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeStoragePath = (rawPath: string): string => {
  const decoded = safeDecodeURIComponent(rawPath);
  const normalized = decoded
    .replace(/\\/g, '/')
    .replace(PATH_CONTROL_CHARS_REGEX, '')
    .replace(MULTI_SLASH_REGEX, '/')
    .replace(/^\/+/, '')
    .trim();

  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === PATH_TRAVERSAL_SEGMENT || segment.includes('\0'))) {
    throw new Error('Path traversal detected');
  }

  return segments.join('/');
};

/**
 * Create a storage service instance with a specific namespace
 */
export function createStorageService(
  s3Client: Bun.S3Client,
  namespace: string,
  bucket: string,
  publicBaseUrl?: string
) {
  const toKey = (relativePath: string): string => {
    const normalizedPath = normalizeStoragePath(relativePath);
    if (!normalizedPath) {
      throw new Error('Invalid path: Empty storage key');
    }

    if (normalizedPath.startsWith(`${namespace}/`)) {
      return normalizedPath;
    }

    return `${namespace}/${normalizedPath}`;
  };

  return {
    /**
     * Save file to S3
     */
    async save(relativePath: string, buffer: Buffer | Blob): Promise<string> {
      const key = toKey(relativePath);
      await s3Client.write(key, buffer);
      return key;
    },

    /**
     * Read file from S3
     */
    async read(relativePath: string): Promise<Buffer> {
      const key = toKey(relativePath);
      const file = s3Client.file(key);
      if (!(await file.exists())) {
        throw new Error(`File not found: ${key}`);
      }

      return Buffer.from(await file.arrayBuffer());
    },

    /**
     * Delete file from S3
     */
    async delete(relativePath: string): Promise<{ success: boolean; error?: string }> {
      const key = toKey(relativePath);
      try {
        await s3Client.delete(key);
        return { success: true };
      } catch (error) {
        logger.error(`Failed to delete file s3://${bucket}/${key}`, {
          key,
          error: String(error)
        });
        return { success: false, error: String(error) };
      }
    },

    /**
     * Resolve public URL for a file
     */
    resolvePath(relativePath: string): string {
      const key = toKey(relativePath);
      if (publicBaseUrl) {
        return `${publicBaseUrl.replace(/\/+$/, '')}/${key}`;
      }
      return `s3://${bucket}/${key}`;
    }
  };
}
