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
import { importStorage } from '@/providers/storage/storage';
import { BE_ERRORS, GEN_ERRORS } from '@repo/errors';
import { apiSuccess, apiError, apiAccepted } from '@/commons/http/response';
import { validateImportUploadFile } from '@/commons/validation/import';
import { logActivity } from '@/commons/activity-logger';
import { enqueueJob, createWorkerJob } from '@/providers/redis/queue';
import {
  parseSpreadsheetFile,
  suggestColumnMapping,
  generatePreviewRows
} from '../services/import-preview.service';
import type { PreviewHandlerContext, ImportFromPreviewContext } from '../types/handler.types';
import { logger } from '@repo/logger';

const importRepo = new ImportRepository(db);

export const importPreview = {
  /**
   * POST /data/import/preview
   * Accepts multipart/form-data with Excel/CSV file.
   * Returns preview data with suggested column mapping.
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

    // Parse the spreadsheet
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = await parseSpreadsheetFile(buffer, file.name);
    if (parseResult.kind === 'error') {
      return apiError(BE_ERRORS.IMPORT_PARSE_ERROR, parseResult.message);
    }
    const parsed = parseResult.data;

    if (parsed.totalRows === 0) {
      return apiError(BE_ERRORS.IMPORT_EMPTY_SHEET);
    }

    // Generate preview ID and store parsed JSON in S3
    const previewId = randomUUIDv7();
    const s3Key = `${previewId}.json`;

    const MAX_PREVIEW_JSON_SIZE = 10 * 1024 * 1024; // 10MB
    const jsonBuffer = Buffer.from(JSON.stringify({
      headers: parsed.headers,
      rows: parsed.rows,
      totalRows: parsed.totalRows,
      fileName: file.name,
      fileSize: file.size,
      parsedAt: new Date().toISOString()
    }));

    if (jsonBuffer.length > MAX_PREVIEW_JSON_SIZE) {
      return apiError(BE_ERRORS.FILE_TOO_LARGE,
        `Parsed data too large (${(jsonBuffer.length / 1024 / 1024).toFixed(1)}MB). Max: 10MB.`
      );
    }

    try {
      await importStorage.save(s3Key, jsonBuffer);
    } catch (err) {
      logger.error('S3 save failed for preview', { s3Key, size: jsonBuffer.length, error: String(err) });
      return apiError(BE_ERRORS.FILE_STORAGE_ERROR, 'Failed to store preview data');
    }

    // Create import log with preview status
    await importRepo.createLog({
      id: previewId,
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      status: 'preview',
      previewLogId: null,
      totalRows: parsed.totalRows,
      importedCount: null,
      errorCount: null,
      errors: null,
      config: JSON.stringify({ s3Key }),
      completedAt: null
    });

    // Suggest column mapping
    const suggestedMapping = suggestColumnMapping(parsed.headers);

    // Generate preview rows (first 10)
    const previewRows = generatePreviewRows(parsed.rows, SHARED_CONSTANTS.IMPORT.PREVIEW_ROWS);

    logActivity({
      userId: user.id,
      action: 'import_preview',
      resource: 'import',
      resourceId: previewId,
      metadata: { fileName: file.name, totalRows: parsed.totalRows, headers: parsed.headers }
    });

    return apiSuccess({
      previewId,
      headers: parsed.headers,
      previewRows,
      totalRows: parsed.totalRows,
      suggestedMapping,
      fileName: file.name
    }, 'Preview generated successfully');
  },

  /**
   * POST /data/import/:id/start
   * Starts import from a preview using column mapping.
   * Enqueues job for background processing via Redis queue.
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

    // Read parsed JSON from S3 to validate it exists
    const config = log.config ? JSON.parse(log.config as string) : {};
    const s3Key = config.s3Key;

    if (!s3Key) {
      return apiError(BE_ERRORS.FILE_STORAGE_ERROR, 'Preview data not found in storage');
    }

    // Validate S3 data is readable
    try {
      await importStorage.read(s3Key);
    } catch (err) {
      return apiError(BE_ERRORS.FILE_STORAGE_ERROR, `Failed to read preview data: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Update log status to queued
    await importRepo.updateLog(log.id, {
      status: 'queued',
      config: JSON.stringify({ s3Key, columnMapping, startRow })
    });

    // Enqueue job for background processing (format expected by apps/worker)
    const jobPayload = createWorkerJob('import', {
      userId: user.id,
      fileName: `import-${log.id}.json`,
      storageKey: s3Key,
      config: { mapping: columnMapping as any, startRow },
      previewLogId: log.id
    });

    await enqueueJob('imports', jobPayload as unknown as Record<string, unknown>);

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
  }
};
