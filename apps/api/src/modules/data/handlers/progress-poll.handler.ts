/**
 * XHR Progress Poll Handler
 * @logicType http
 *
 * POST /data/import/progress-poll
 * Body: { logIds: string[] }
 * Response: { data: { [logId]: ImportProgress }, meta: { hasActiveJobs: boolean } }
 */
import { getJobStatus } from '@/providers/redis/queue';
import { ImportRepository } from '@/repositories/data/import.repo';
import { db } from '@/providers/database';
import { apiSuccess, apiError } from '@/commons/http/response';
import { GEN_ERRORS } from '@repo/errors';
import type { AuthenticatedHandlerContext } from '@repo/types/api/handler-context';
import { logger } from '@repo/logger';
import { cache } from '@/providers/redis';
import { importStorage } from '@/providers/storage/storage';

const importRepo = new ImportRepository(db);

interface ProgressPollBody {
  logIds: string[];
}

type ProgressPollContext = AuthenticatedHandlerContext<ProgressPollBody>;

export const progressPoll = {
  poll: async ({ body, user }: ProgressPollContext) => {
    const { logIds } = body;

    if (!Array.isArray(logIds) || logIds.length === 0) {
      return apiError(GEN_ERRORS.INVALID_INPUT, 'logIds array is required');
    }

    if (logIds.length > 20) {
      return apiError(GEN_ERRORS.INVALID_INPUT, 'Maximum 20 logIds allowed');
    }

    const results: Record<string, unknown> = {};
    let hasActiveJobs = false;

    for (const logId of logIds) {
      // 1. Try Redis first (real-time worker progress)
      const redisStatus = await getJobStatus(logId);
      if (redisStatus?.progress) {
        const progress = redisStatus.progress as Record<string, unknown>;

        // If the progress is successful and this is a preview job, we load the preview data!
        if (progress.status === 'success') {
          // Check if this is a preview log in DB
          const log = await importRepo.getLogById(logId, user.id);
          if (log && log.status === 'preview') {
            let previewDetails: any = null;
            try {
              previewDetails = await cache.get(`preview_data:${logId}`);
            } catch {}

            if (!previewDetails) {
              try {
                const s3Data = await importStorage.read(`${logId}.json`);
                if (s3Data) {
                  previewDetails = JSON.parse(s3Data.toString('utf-8'));
                }
              } catch {}
            }

            if (previewDetails) {
              progress.result = {
                data: {
                  columnHeaders: previewDetails.columnHeaders,
                  previewData: previewDetails.previewRows || previewDetails.previewData?.slice(0, 10) || [],
                  autoMapping: previewDetails.autoMapping,
                  totalRows: previewDetails.totalRows,
                  fileName: previewDetails.fileName
                }
              };
            }
          }
        }

        results[logId] = progress;
        if (progress.status !== 'success' && progress.status !== 'failed' && progress.status !== 'cancelled') {
          hasActiveJobs = true;
        }
        continue;
      }

      // 2. Fallback to DB
      const log = await importRepo.getLogById(logId, user.id);
      if (log) {
        let errors: string[] | undefined;
        if (log.errors) {
          try {
            errors = JSON.parse(log.errors as string);
          } catch (_parseErr) {
            logger.warn('Failed to parse progress errors JSON', { logId });
            errors = [String(log.errors)];
          }
        }

        let result: any = undefined;
        if (log.status === 'preview') {
          try {
            const s3Data = await importStorage.read(`${logId}.json`);
            if (s3Data) {
              const previewDetails = JSON.parse(s3Data.toString('utf-8'));
              result = {
                data: {
                  columnHeaders: previewDetails.columnHeaders,
                  previewData: previewDetails.previewRows || previewDetails.previewData?.slice(0, 10) || [],
                  autoMapping: previewDetails.autoMapping,
                  totalRows: previewDetails.totalRows,
                  fileName: previewDetails.fileName
                }
              };
            }
          } catch {}
        }

        results[logId] = {
          status: log.status === 'preview' ? 'success' : log.status,
          current: log.importedCount || 0,
          total: log.totalRows || 0,
          percentage: log.status === 'success' || log.status === 'preview' ? 100 : 0,
          errors,
          completedAt: log.completedAt,
          result
        };
        if (log.status !== 'success' && log.status !== 'failed' && log.status !== 'cancelled' && log.status !== 'preview') {
          hasActiveJobs = true;
        }
      }
    }

    return apiSuccess(results, undefined, {
      hasActiveJobs,
      serverTime: new Date().toISOString()
    });
  }
};

