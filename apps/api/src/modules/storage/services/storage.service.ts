/**
 * Storage Service - Pure Functions
 * @logicType backend
 */

import type { Result } from '@repo/types';
import { BE_ERRORS } from '@repo/errors';
import { randomUUIDv7 } from 'bun';

const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
  ],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]]
};

const WEBP_MAGIC_BYTES = [0x57, 0x45, 0x42, 0x50];

/**
 * Validate file type
 */
export function validateFileType(contentType: string, allowedTypes: string[]): Result<void> {
  if (!allowedTypes.includes(contentType)) {
    return { code: BE_ERRORS.FILE_TYPE_INVALID.code, error: `File type must be one of: ${allowedTypes.join(', ')}` };
  }
  return { data: undefined };
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxSize: number): Result<void> {
  if (size > maxSize) {
    return { code: BE_ERRORS.FILE_SIZE_INVALID.code, error: `File size must be less than ${maxSize / 1024 / 1024}MB` };
  }
  return { data: undefined };
}

function matchesSignature(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

function isWebpBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const riffMatches = matchesSignature(buffer, FILE_SIGNATURES['image/webp'][0]);
  if (!riffMatches) return false;

  return WEBP_MAGIC_BYTES.every((byte, index) => buffer[8 + index] === byte);
}

/**
 * Validate binary file signature to prevent MIME spoofing.
 */
export function validateFileSignature(buffer: Buffer, contentType: string): Result<void> {
  if (contentType === 'image/webp') {
    if (isWebpBuffer(buffer)) return { data: undefined };
    return { code: BE_ERRORS.FILE_CONTENT_MISMATCH.code, error: BE_ERRORS.FILE_CONTENT_MISMATCH.message };
  }

  const signatures = FILE_SIGNATURES[contentType];
  if (!signatures || signatures.length === 0) {
    return { code: BE_ERRORS.FILE_INVALID_TYPE.code, error: BE_ERRORS.FILE_INVALID_TYPE.message };
  }

  const valid = signatures.some((signature) => matchesSignature(buffer, signature));
  if (!valid) {
    return { code: BE_ERRORS.FILE_CONTENT_MISMATCH.code, error: BE_ERRORS.FILE_CONTENT_MISMATCH.message };
  }

  return { data: undefined };
}

/**
 * Generate file key
 */
export function generateFileKey(userId: string, originalName: string): string {
  const timestamp = Date.now();
  const random = randomUUIDv7().split('-')[0];
  const extension = originalName.split('.').pop();
  return `uploads/${userId}/${timestamp}-${random}.${extension}`;
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop() || '';
}

/**
 * Check if file is image
 */
export function isImageFile(contentType: string): boolean {
  return contentType.startsWith('image/');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
