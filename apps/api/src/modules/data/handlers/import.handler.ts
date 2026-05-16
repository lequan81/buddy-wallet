/**
 * Data Import Handler — Real Implementation
 * @logicType http
 *
 * Processes debt imports via background queue with progress tracking.
 * Stores import logs in DB, enqueues jobs for async processing.
 */

import { randomUUIDv7 } from 'bun';
import { SHARED_CONSTANTS } from '@repo/config';
import { db } from '@/providers/database';
import { ImportRepository } from '@/repositories/data/import.repo';
import { BE_ERRORS, GEN_ERRORS } from '@repo/errors';
import { apiSuccess, apiError, apiAccepted } from '@/commons/http/response';
import { logActivity } from '@/commons/activity-logger';
import { enqueueJob, createWorkerJob, getJobStatus } from '@/providers/redis/queue';
import type { ImportDataContext, ImportLogsContext, ImportProgressContext, ImportRemapContext } from '../types/handler.types';
import { logger } from '@repo/logger';

const importRepo = new ImportRepository(db);

export const dataImport = {
  /** POST /data/import — Enqueue import job for background processing */
  importData: async ({ body, user }: ImportDataContext) => {
    const { type, data: importData } = body;

    if (type !== 'debts') {
      return apiError(BE_ERRORS.IMPORT_INVALID_FORMAT);
    }

    if (!Array.isArray(importData)) {
      return apiError(BE_ERRORS.IMPORT_PARSE_ERROR);
    }

    if (importData.length === 0) {
      return apiError(BE_ERRORS.IMPORT_EMPTY_SHEET);
    }

    if (importData.length > SHARED_CONSTANTS.IMPORT.MAX_ROWS) {
      return apiError(BE_ERRORS.RATE_LIMITED);
    }

    // Create import log
    const logId = randomUUIDv7();
    await importRepo.createLog({
      id: logId,
      userId: user.id,
      fileName: `import-${Date.now()}.json`,
      fileSize: JSON.stringify(importData).length,
      status: 'queued',
      previewLogId: null,
      totalRows: importData.length,
      importedCount: null,
      errorCount: null,
      errors: null,
      config: JSON.stringify({ directData: importData }),
      completedAt: null
    });

    // Enqueue job for background processing (format expected by apps/worker)
    const jobPayload = createWorkerJob('import', {
      userId: user.id,
      fileName: `import-${Date.now()}.json`,
      config: undefined, // Direct data mode doesn't use column mapping
      previewLogId: undefined
    });

    // Store direct data in Redis for worker to pick up
    const { getClient } = await import('@/providers/redis/connection');
    const client = getClient();
    if (client) {
      await client.setex(`import_data:${logId}`, 3600, JSON.stringify(importData));
    }

    await enqueueJob('imports', jobPayload as unknown as Record<string, unknown>);
    logActivity({
      userId: user.id,
      action: 'import',
      resource: 'import',
      resourceId: logId,
      metadata: { type, totalRows: importData.length, status: 'queued' }
    });

    return apiAccepted({
      importId: logId,
      status: 'queued',
      totalRows: importData.length
    }, 'Import queued for background processing');
  },

  /** GET /data/import/logs — List import history */
  getLogs: async ({ query, user }: ImportLogsContext) => {
    const { page = 1, limit = 20 } = query;
    const result = await importRepo.getLogsPaginated(user.id, limit, (page - 1) * limit);

    return apiSuccess(result.items, undefined, {
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit
    });
  },

  /** GET /data/import/:id/progress — Get import progress */
  getProgress: async ({ params, user }: ImportProgressContext) => {
    // 1. Try Redis first (real-time worker progress)
    const redisStatus = await getJobStatus(params.id);
    if (redisStatus?.progress) {
      const progress = redisStatus.progress as Record<string, unknown>;
      return apiSuccess({
        id: params.id,
        status: progress.status || 'processing',
        totalRows: progress.total || 0,
        importedCount: progress.current || 0,
        errorCount: progress.errorCount || 0,
        errors: progress.errors || undefined,
        completedAt: progress.completedAt || null
      });
    }

    // 2. Fallback to DB
    const log = await importRepo.getLogById(params.id, user.id);
    if (!log) {
      return apiError(GEN_ERRORS.NOT_FOUND);
    }

    let errors: string[] | undefined;
    if (log.errors) {
      try {
        errors = JSON.parse(log.errors as string);
      } catch (_parseErr) {
        logger.warn('Failed to parse error log JSON', { logId: params.id });
        errors = [String(log.errors)];
      }
    }

    return apiSuccess({
      id: log.id,
      status: log.status,
      totalRows: log.totalRows,
      importedCount: log.importedCount,
      errorCount: log.errorCount,
      errors,
      completedAt: log.completedAt
    });
  },

  /** POST /data/import/:id/remap — Re-map columns from existing import */
  remap: async ({ params, body, user }: ImportRemapContext) => {
    const log = await importRepo.getLogById(params.id, user.id);
    if (!log) {
      return apiError(GEN_ERRORS.NOT_FOUND);
    }

    const { columnMapping } = body as { columnMapping?: Record<string, string> };
    if (!columnMapping || Object.keys(columnMapping).length === 0) {
      return apiError(BE_ERRORS.INVALID_INPUT, 'Column mapping is required for re-mapping');
    }

    // Read parsed JSON from S3
    const config = log.config ? JSON.parse(log.config as string) : {};
    const s3Key = config.s3Key;

    if (!s3Key) {
      return apiError(BE_ERRORS.IMPORT_INVALID_FORMAT, 'No stored preview data available for re-mapping. Re-upload the file.');
    }

    let parsedData: { headers: string[]; rows: Record<string, unknown>[]; totalRows: number };
    try {
      const { importStorage } = await import('@/providers/storage/storage');
      const buffer = await importStorage.read(s3Key);
      parsedData = JSON.parse(buffer.toString());
    } catch (err) {
      logger.error('Failed to read preview data from S3', { s3Key, error: String(err) });
      return apiError(BE_ERRORS.FILE_STORAGE_ERROR, 'Failed to read stored preview data');
    }

    // Return the preview data with new mapping suggestions
    const { suggestColumnMapping, generatePreviewRows } = await import('../services/import-preview.service');
    const suggestedMapping = suggestColumnMapping(parsedData.headers);
    const previewRows = generatePreviewRows(parsedData.rows, SHARED_CONSTANTS.IMPORT.PREVIEW_ROWS);

    return apiSuccess({
      importId: log.id,
      headers: parsedData.headers,
      previewRows,
      totalRows: parsedData.totalRows,
      suggestedMapping: { ...suggestedMapping, ...columnMapping },
      fileName: log.fileName,
      message: 'Preview loaded. Adjust mapping and start import.'
    });
  }
};
