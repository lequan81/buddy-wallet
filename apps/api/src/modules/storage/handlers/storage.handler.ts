/**
 * Storage Handlers
 * @logicType http
 */

import { db } from '@/providers/database';
import { uploadStorage } from '@/providers/storage';
import { FileRepository } from '@/repositories/storage/file.repo';
import { BE_ERRORS } from '@repo/errors';
import { calculatePagination } from '@/commons/pagination';
import { SHARED_CONSTANTS } from '@repo/config';
import {
  validateFileType,
  validateFileSize,
  validateFileSignature,
  generateFileKey
} from '../services/storage.service';
import type { GetFileUrlContext, ListFilesContext, RemoveFileContext, UploadFileContext } from '../types/handler.types';
import { apiSuccess, apiError, apiCreated } from '@/commons/http/response';

const MAX_FILE_SIZE = SHARED_CONSTANTS.IMPORT.MAX_FILE_SIZE;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const fileRepo = new FileRepository(db);

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

    await uploadStorage.save(key, buffer);
    const metadata = await fileRepo.createUpload({
      uploadedById: user.id,
      storagePath: key,
      mimeType: file.type,
      sizeBytes: file.size
    }).catch(async () => {
      await uploadStorage.delete(key);
      return null;
    });

    if (!metadata) {
      return apiError(BE_ERRORS.FILE_UPLOAD_FAILED);
    }

    const url = uploadStorage.resolvePath(metadata.storagePath);

    return apiCreated({
      key: metadata.storagePath,
      url,
      size: metadata.sizeBytes,
      contentType: metadata.mimeType,
      uploadedAt: metadata.createdAt
    }, 'File uploaded successfully');
  },

  /** DELETE /storage/file */
  remove: async ({ body, user }: RemoveFileContext) => {
    const { key } = body;
    const file = await fileRepo.findByStoragePathAndUser(key, user.id);
    if (!file) {
      return apiError(BE_ERRORS.FILE_NOT_FOUND);
    }

    const deleteResult = await uploadStorage.delete(key);
    if (!deleteResult.success) {
      return apiError(BE_ERRORS.FILE_UPLOAD_FAILED, `Failed to delete file from storage: ${deleteResult.error}`);
    }
    await fileRepo.deleteByStoragePathAndUser(key, user.id);
    return apiSuccess({ deleted: true }, 'File deleted successfully');
  },

  /** GET /storage/file/:key */
  getUrl: async ({ params, user }: GetFileUrlContext) => {
    const { key } = params;
    const file = await fileRepo.findByStoragePathAndUser(key, user.id);
    if (!file) {
      return apiError(BE_ERRORS.FILE_NOT_FOUND);
    }

    return apiSuccess({ url: uploadStorage.resolvePath(file.storagePath) });
  },

  /** GET /storage/files */
  list: async ({ query, user }: ListFilesContext) => {
    const { page = 1, limit = 20 } = query;

    const result = await fileRepo.findByUserIdPaginated(user.id, limit, (page - 1) * limit);

    const filesWithUrls = result.data.map((file) => ({
      key: file.storagePath,
      url: uploadStorage.resolvePath(file.storagePath),
      size: file.sizeBytes,
      contentType: file.mimeType,
      uploadedAt: file.createdAt
    }));

    return apiSuccess(filesWithUrls, undefined, calculatePagination(result.total, page, limit) as unknown as Record<string, unknown>);
  }
};
