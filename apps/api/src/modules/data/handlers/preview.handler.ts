/**
 * Import Preview Handler — File Upload & Preview
 * @logicType http
 *
 * Handles multipart file uploads for import preview.
 * Parses Excel/CSV files, suggests column mappings, stores
 * parsed JSON in S3 for fast re-mapping.
 */

import { randomUUIDv7 } from 'bun';
import { SHARED_CONSTANTS } from '@repo/config';
import { db } from '@/providers/database';
import { ImportRepository } from '@/repositories/data/import.repo';
import { importStorage, rawImportStorage } from '@/providers/storage/storage';
import { BE_ERRORS, GEN_ERRORS } from '@repo/errors';
import { apiSuccess, apiError, apiAccepted } from '@/commons/http/response';
import { validateImportUploadFile } from '@/commons/validation/import';
import { logActivity } from '@/commons/logging/activity-logger';
import { enqueueJob, createWorkerJob } from '@/providers/redis/queue';
import type { PreviewHandlerContext, ImportFromPreviewContext, ImportPreviewData } from '../types/handler.types';
import { logger } from '@repo/logger';
import { cache } from '@/providers/redis';
import type { AuthenticatedHandlerContext } from '@repo/types/api/handler-context';

const importRepo = new ImportRepository(db);

export const importPreview = {
  /**
   * POST /data/import/preview
   * Accepts multipart/form-data with Excel/CSV file.
   * Uploads file to S3 raw area, inserts queued database log, and enqueues background preview job.
   */
  preview: async ({ body, user }: PreviewHandlerContext) => {
    const file = (body as { file?: File })?.file;

    if (!file || !(file instanceof File) || file.size === 0) {
      return apiError(BE_ERRORS.IMPORT_PARSE_ERROR, 'No file provided');
    }

    // Validate file type and size
    const validationError = await validateImportUploadFile(file);
    if (validationError) {
      return validationError;
    }

    // Strictly validate extension to prevent path traversal / format exploits
    const ext = file.name.split('.').pop()?.toLowerCase() || 'xlsx';
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      return apiError(BE_ERRORS.IMPORT_INVALID_FORMAT, 'Invalid file extension. Accepted: xlsx, xls, csv');
    }

    const previewId = randomUUIDv7();
    const s3FileName = `${previewId}.${ext}`;

    // Upload raw file to rawImportStorage (imports/raw)
    const buffer = Buffer.from(await file.arrayBuffer());
    let s3Key: string;
    try {
      s3Key = await rawImportStorage.save(s3FileName, buffer);
    } catch (err) {
      logger.error('S3 raw save failed for preview', { s3FileName, size: buffer.length, error: String(err) });
      return apiError(BE_ERRORS.FILE_STORAGE_ERROR, 'Failed to store raw preview file');
    }

    // Create import log with queued status
    await importRepo.createLog({
      id: previewId,
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      status: 'queued',
      previewLogId: null,
      totalRows: null,
      importedCount: null,
      errorCount: null,
      errors: null,
      config: JSON.stringify({ s3Key }),
      completedAt: null
    });

    // Enqueue job for background processing
    const jobPayload = createWorkerJob('preview', {
      userId: user.id,
      fileName: file.name,
      storageKey: s3Key,
      config: { fileSize: file.size },
      previewLogId: previewId
    });

    const queued = await enqueueJob('imports', jobPayload as unknown as Record<string, unknown>);
    if (!queued) {
      logger.warn('Redis enqueue unavailable, SQLite polling fallback will pick queued preview job', { previewId });
    }

    logActivity({
      userId: user.id,
      action: 'import_preview',
      resource: 'import',
      resourceId: previewId,
      metadata: { fileName: file.name, status: 'queued' }
    });

    return apiAccepted({
      previewId,
      jobId: previewId,
      status: 'queued',
      fileName: file.name
    }, 'File uploaded and preview generation queued successfully');
  },

  /**
   * POST /data/import/:id/start
   * Starts import from a preview using column mapping.
   * Enqueues job for background processing via Redis/SQLite queue.
   */
  startFromPreview: async ({ params, body, user }: ImportFromPreviewContext) => {
    const { columnMapping, startRow = 1 } = body as { columnMapping?: Record<string, string>; startRow?: number };

    if (!columnMapping || Object.keys(columnMapping).length === 0) {
      return apiError(BE_ERRORS.INVALID_INPUT, 'Column mapping is required');
    }

    // Fetch preview log
    const log = await importRepo.getLogById(params.id, user.id);
    if (!log) {
      return apiError(GEN_ERRORS.NOT_FOUND);
    }

    if (log.status !== 'preview') {
      return apiError(BE_ERRORS.IMPORT_INVALID_FORMAT, 'Import log is not in preview status');
    }

    // Read config from log
    const config = log.config ? JSON.parse(log.config as string) : {};
    const s3Key = config.s3Key;

    if (!s3Key) {
      return apiError(BE_ERRORS.FILE_STORAGE_ERROR, 'Raw file path not found in config');
    }

    // Validate raw spreadsheet is readable in S3
    try {
      await rawImportStorage.read(s3Key);
    } catch (err) {
      return apiError(BE_ERRORS.FILE_STORAGE_ERROR, `Failed to read raw file: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Update log status to queued and record mapping
    await importRepo.updateLog(log.id, {
      status: 'queued',
      config: JSON.stringify({ s3Key, columnMapping, startRow })
    });

    // Enqueue job for background processing
    const jobPayload = createWorkerJob('import', {
      userId: user.id,
      fileName: log.fileName,
      storageKey: s3Key,
      config: { mapping: columnMapping as any, startRow },
      previewLogId: log.id
    });

    const queued = await enqueueJob('imports', jobPayload as unknown as Record<string, unknown>);
    if (!queued) {
      logger.warn('Redis enqueue unavailable, SQLite polling fallback will pick queued import job', { id: log.id });
    }

    logActivity({
      userId: user.id,
      action: 'import',
      resource: 'import',
      resourceId: log.id,
      metadata: { totalRows: log.totalRows, status: 'queued' }
    });

    return apiAccepted({
      importId: log.id,
      status: 'queued',
      totalRows: log.totalRows
    }, 'Import queued for background processing');
  },

  /**
   * GET /data/import/:id/preview-data
   * Returns parsed spreadsheet preview columns, rows, and auto-mapping from Redis/S3.
   */
  getPreviewData: async ({ params, user }: AuthenticatedHandlerContext<unknown, { id: string }>) => {
    const { id } = params;

    // Enforce ownership: only allow the user who uploaded the file to retrieve its preview data
    const log = await importRepo.getLogById(id, user.id);
    if (!log) {
      return apiError(GEN_ERRORS.NOT_FOUND, 'Import log not found or unauthorized');
    }

    // 1. Try Redis first (fast path)
    try {
      const cached = await cache.get<ImportPreviewData>(`preview_data:${id}`);
      if (cached) {
        logger.info('Preview data loaded from Redis cache', { id });
        return apiSuccess(cached);
      }
    } catch (err) {
      logger.warn('Failed to get preview data from Redis cache', { id, error: String(err) });
    }

    // 2. Fallback to S3 (durable path)
    try {
      const s3Data = await importStorage.read(`${id}.json`);
      if (s3Data) {
        const parsed = JSON.parse(s3Data.toString('utf-8')) as ImportPreviewData;
        logger.info('Preview data loaded from S3 fallback', { id });
        return apiSuccess(parsed);
      }
    } catch (err) {
      logger.error('Failed to read preview data from S3 fallback', { id, error: String(err) });
    }

    return apiError(BE_ERRORS.IMPORT_PARSE_ERROR, 'Preview data not available. Please wait or re-upload.');
  }
};

