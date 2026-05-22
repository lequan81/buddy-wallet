/**
 * Storage Handlers
 * @logicType http
 */

import { uploadStorage } from '@/providers/storage';
import { BE_ERRORS } from '@repo/errors';
import { calculatePagination } from '@/commons/http/pagination';
import { SHARED_CONSTANTS } from '@repo/config';
import {
  validateFileType,
  validateFileSize,
  validateFileSignature,
  generateFileKey
} from '../services/storage.service';
import type { GetFileUrlContext, ListFilesContext, RemoveFileContext, UploadFileContext } from '../types/handler.types';
import { apiSuccess, apiError, apiCreated } from '@/commons/http/response';
import { logActivity } from '@/commons/logging/activity-logger';
import { enqueueJob } from '@/providers/redis/queue';
import { randomUUIDv7 } from 'bun';

const MAX_FILE_SIZE = SHARED_CONSTANTS.IMPORT.MAX_FILE_SIZE;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Check if a storage key belongs to the given user.
 * Keys follow the pattern: uploads/{userId}/{timestamp}-{random}.{ext}
 */
function isOwnedByUser(key: string, userId: string): boolean {
  return key.startsWith(`uploads/${userId}/`);
}

export const storage = {
  /** POST /storage/upload */
  upload: async ({ body, user }: UploadFileContext) => {
    const { file } = body;

    const typeV = validateFileType(file.type, ALLOWED_IMAGE_TYPES);
    if ('code' in typeV) { return apiError(BE_ERRORS.FILE_INVALID_TYPE, typeV.error); }
    const sizeV = validateFileSize(file.size, MAX_FILE_SIZE);
    if ('code' in sizeV) { return apiError(BE_ERRORS.FILE_TOO_LARGE, sizeV.error); }

    const key = generateFileKey(user.id, file.name);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const signatureV = validateFileSignature(buffer, file.type);
    if ('code' in signatureV) {
      return apiError(BE_ERRORS.FILE_CONTENT_MISMATCH, signatureV.error);
    }

    // Upload original temporarily
    await uploadStorage.save(key, buffer);

    // Enqueue image: WorkerJobPayload processing job for avatar
    const jobPayload = {
      type: 'image_processing' as const,
      jobId: randomUUIDv7(),
      userId: user.id,
      fileName: file.name,
      storageKey: key,
      imageType: 'avatar' as const,
      config: { avatar: { sizes: { thumbnail: { width: 64, height: 64 }, medium: { width: 400, height: 400 } } } }
    };
    const queued = await enqueueJob('image_processing', jobPayload as unknown as Record<string, unknown>);
    if (!queued) {
      await uploadStorage.delete(key).catch(() => undefined);
      return apiError(BE_ERRORS.QUEUE_UNAVAILABLE, 'Image processing queue is currently unavailable');
    }

    logActivity({
      userId: user.id,
      action: 'upload',
      resource: 'file',
      resourceId: key,
      metadata: { fileName: file.name, size: file.size, contentType: file.type, jobId: jobPayload.jobId }
    });

    return apiCreated({
      jobId: jobPayload.jobId,
      status: 'processing',
      message: 'Image uploaded and processing started'
    }, 'File uploaded successfully');
  },

  /** DELETE /storage/file */
  remove: async ({ body, user }: RemoveFileContext) => {
    const { key } = body;

    if (!isOwnedByUser(key, user.id)) {
      return apiError(BE_ERRORS.FILE_PERMISSION_DENIED, 'You do not have permission to delete this file');
    }

    const deleteResult = await uploadStorage.delete(key);
    if (!deleteResult.success) {
      return apiError(BE_ERRORS.FILE_UPLOAD_FAILED, `Failed to delete file from storage: ${deleteResult.error}`);
    }

    logActivity({
      userId: user.id,
      action: 'delete',
      resource: 'file',
      resourceId: key
    });

    return apiSuccess({ deleted: true }, 'File deleted successfully');
  },

  /** GET /storage/file/:key */
  getUrl: async ({ params, user }: GetFileUrlContext) => {
    const { key } = params;

    if (!isOwnedByUser(key, user.id)) {
      return apiError(BE_ERRORS.FILE_PERMISSION_DENIED, 'You do not have permission to access this file');
    }

    return apiSuccess({ url: uploadStorage.resolvePath(key) });
  },

  /** GET /storage/files */
  list: async ({ query, user: _user }: ListFilesContext) => {
    const { page = 1, limit = 20 } = query;

    // File metadata is no longer tracked in the database.
    // S3 listing is not exposed through the storage service.
    // Return empty list — files are managed directly via the storage provider.
    return apiSuccess([], undefined, calculatePagination(0, page, limit) as unknown as Record<string, unknown>);
  }
};
