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
import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import { logger } from '@repo/logger';

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

        results[logId] = {
          status: log.status,
          current: log.importedCount || 0,
          total: log.totalRows || 0,
          percentage: log.status === 'success' ? 100 : 0,
          errors,
          completedAt: log.completedAt
        };
        if (log.status !== 'success' && log.status !== 'failed' && log.status !== 'cancelled') {
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
