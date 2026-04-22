/**
 * Import Log Service
 *
 * Handles import log retrieval and progress tracking.
 */
import { injectable, inject } from 'tsyringe';
import { importCache, isRedisAvailable } from '@infra/Redis';
import type { ProgressResult, Result } from '@/types';
import type { ImportRepositoryInterface } from '@/app/Repositories/Contracts/ImportRepositoryInterface';

/**
 * ImportLogService - Handles import log and progress operations
 */
@injectable()
export class ImportLogService {
  constructor(
    @inject('ImportRepositoryInterface') private readonly importRepo: ImportRepositoryInterface
  ) { }

  /**
   * Get progress for multiple logs (Batch)
   * Optimization to reduce HTTP/JWT overhead
   */
  async getProgressBatch(
    logIds: string[],
    userId: string
  ): Promise<Result<Record<string, ProgressResult>>> {
    const results: Record<string, ProgressResult> = {};
    if (logIds.length === 0) return { data: results };

    if (isRedisAvailable()) {
      const progresses = await importCache.getProgressBatch(logIds);
      for (let i = 0; i < logIds.length; i++) {
        const id = logIds[i];
        const progress = progresses[i];
        if (progress) {
          results[id] = {
            data: {
              status: progress.status as unknown as 'pending' | 'processing' | 'success' | 'failed',
              current: progress.current,
              total: progress.total,
              percentage: Math.round((progress.current / (progress.total || 1)) * 100),
              message: progress.message,
              errors: progress.errors,
              result: progress.result as any
            }
          };
        }
      }
    }

    // 2. Fallback to DB for missing keys (older jobs)
    const missingIds = logIds.filter((id) => !results[id]);
    if (missingIds.length > 0) {
      const logs = await this.importRepo.getLogsByIds(missingIds, userId);
      for (const log of logs) {
        results[log.id] = {
          data: {
            current: log.importedCount || 0,
            total: log.totalRows || 0,
            status: log.status as unknown as 'pending' | 'processing' | 'success' | 'failed',
            errors: log.errors ? JSON.parse(log.errors) : undefined,
            percentage: log.totalRows ? Math.round(((log.importedCount || 0) / log.totalRows) * 100) : 0,
            message: ''
          }
        };
      }
    }

    return { data: results };
  }

  /**
   * Get import progress
   */
  async getProgress(logId: string, userId: string): Promise<ProgressResult> {
    if (isRedisAvailable()) {
      const progress = await importCache.getProgress(logId);
      if (progress) {
        return {
          data: {
            status: progress.status as unknown as 'pending' | 'processing' | 'success' | 'failed',
            current: progress.current,
            total: progress.total,
            percentage: Math.round((progress.current / (progress.total || 1)) * 100),
            message: progress.message,
            errors: progress.errors,
            result: progress.result as any
          }
        };
      }
    }

    const log = await this.importRepo.getLogById(logId, userId);

    if (!log) {
      return { code: 'NOT_FOUND', error: 'Import log not found' };
    }

    return {
      data: {
        status: log.status as unknown as 'pending' | 'processing' | 'success' | 'failed',
        current: log.importedCount || 0,
        total: log.totalRows || 0,
        percentage: log.totalRows ? Math.round(((log.importedCount || 0) / log.totalRows) * 100) : 0,
        message: '',
        errors: log.errors ? JSON.parse(log.errors) : undefined
      }
    };
  }

  /**
   * Get paginated import logs
   */
  async getLogs(userId: string, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    const result = await this.importRepo.getLogsPaginated(userId, limit, offset);
    return result;
  }

  /**
   * Get single import log by ID
   */
  async getLogById(id: string, userId: string) {
    const log = await this.importRepo.getLogById(id, userId);

    if (!log) return null;

    // Parse config JSON if available (contains preview data, column mapping, etc)
    let previewData: string[][] = [];
    let columnHeaders: string[] = [];
    let columnMapping: Record<string, string> = {};
    let startRow = 2;

    if (log.config) {
      try {
        const parsed = JSON.parse(log.config);
        previewData = parsed.previewData || [];
        columnHeaders = parsed.columnHeaders || [];
        columnMapping = parsed.columnMapping || {};
        startRow = parsed.startRow || 2;
      } catch {
        // Ignore parse errors
      }
    }

    return {
      ...log,
      previewData,
      columnHeaders,
      columnMapping,
      startRow,
      errors: log.errors ? JSON.parse(log.errors) : []
    };
  }
}
