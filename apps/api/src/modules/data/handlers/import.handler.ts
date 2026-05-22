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
import { logActivity } from '@/commons/logging/activity-logger';
import { enqueueJob, createWorkerJob, getJobStatus } from '@/providers/redis/queue';
import { isRedisAvailable, cache } from '@/providers/redis';
import { importStorage } from '@/providers/storage/storage';
import type { ImportDataContext, ImportLogsContext, ImportProgressContext, ImportRemapContext, ImportPreviewData } from '../types/handler.types';
import { logger } from '@repo/logger';

const importRepo = new ImportRepository(db);

export const dataImport = {
  /** POST /data/import — Enqueue import job for background processing */
  importData: async ({ body, user }: ImportDataContext) => {
    // Fail-fast if Redis is down
    if (!isRedisAvailable()) {
      return apiError(BE_ERRORS.REDIS_UNAVAILABLE, 'Queue and cache server (Redis) is currently down. Please try again later.');
    }

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
      jobId: logId,
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

    const queued = await enqueueJob('imports', jobPayload as unknown as Record<string, unknown>);
    if (!queued) {
      await importRepo.updateLog(logId, {
        status: 'failed',
        errors: JSON.stringify(['Queue unavailable. Please retry import later.']),
        completedAt: new Date()
      });
      return apiError(BE_ERRORS.QUEUE_UNAVAILABLE, 'Queue unavailable. Please retry import later.');
    }
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
    // 1. Fetch DB log first to get static details (fileName, fileSize, userId, createdAt, config, previewLogId, etc.)
    const log = await importRepo.getLogById(params.id, user.id);
    if (!log) {
      return apiError(GEN_ERRORS.NOT_FOUND);
    }

    // 2. Try Redis for real-time worker progress
    const redisStatus = await getJobStatus(params.id);
    const progress = redisStatus?.progress as Record<string, unknown> | undefined;

    // Determine status and other dynamic fields
    const status = progress?.status || log.status;
    const totalRows = typeof progress?.total === 'number' ? progress.total : log.totalRows;
    const importedCount = typeof progress?.current === 'number' ? progress.current : log.importedCount;
    const errorCount = typeof progress?.errorCount === 'number' ? progress.errorCount : log.errorCount;
    
    let errors: string[] | undefined = undefined;
    if (progress?.errors) {
      errors = progress.errors as string[];
    } else if (log.errors) {
      try {
        errors = JSON.parse(log.errors as string);
      } catch (_parseErr) {
        logger.warn('Failed to parse error log JSON', { logId: params.id });
        errors = [String(log.errors)];
      }
    }

    const completedAt = (progress?.completedAt || log.completedAt)
      ? new Date((progress?.completedAt || log.completedAt) as string | number | Date)
      : null;

    // Parse column mapping config
    let columnMapping: Record<string, string> | undefined = undefined;
    let startRow: number | undefined = undefined;
    if (log.config) {
      try {
        const configObj = JSON.parse(log.config as string);
        columnMapping = configObj.mapping || {};
        startRow = configObj.startRow ?? 2;
      } catch (_e) {
        // Ignore parsing error
      }
    }

    // Load preview details if status is 'preview'
    let columnHeaders: string[] | undefined = undefined;
    let previewData: string[][] | undefined = undefined;
    
    if (status === 'preview') {
      try {
        // Try Cache first
        let previewDetails = await cache.get<ImportPreviewData>(`preview_data:${params.id}`);
        
        // Try S3 if not in cache
        if (!previewDetails) {
          const s3Data = await importStorage.read(`${params.id}.json`);
          if (s3Data) {
            previewDetails = JSON.parse(s3Data.toString('utf-8')) as ImportPreviewData;
          }
        }

        if (previewDetails) {
          columnHeaders = previewDetails.columnHeaders;
          previewData = previewDetails.previewRows || previewDetails.previewData?.slice(0, 10) || [];
        }
      } catch (err) {
        logger.warn('Failed to load preview details for getProgress:', { logId: params.id, error: String(err) });
      }
    }

    return apiSuccess({
      id: log.id,
      userId: log.userId,
      fileName: log.fileName,
      fileSize: log.fileSize,
      status,
      previewLogId: log.previewLogId,
      totalRows,
      importedCount,
      errorCount,
      errors,
      completedAt,
      createdAt: log.createdAt,
      columnMapping,
      startRow,
      columnHeaders,
      previewData
    });
  },

  /** POST /data/import/:id/remap — Re-map columns from existing import */
  remap: async ({ params, body, user }: ImportRemapContext) => {
    // Fail-fast if Redis is down
    if (!isRedisAvailable()) {
      return apiError(BE_ERRORS.REDIS_UNAVAILABLE, 'Queue and cache server (Redis) is currently down. Please try again later.');
    }

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
