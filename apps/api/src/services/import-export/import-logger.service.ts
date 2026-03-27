import { importLogs, eq } from '@repo/db';
import { importCache, isRedisAvailable } from '@plugins/redis';
import type { ImportProgress } from '@plugins/redis';
import type { DbClient } from '@/types';

export class ImportLoggerService {
  constructor(private db: DbClient) {}

  async updateLogStatus(
    logId: string,
    status: 'pending' | 'processing' | 'success' | 'failed',
    errors: string[],
    result?: unknown
  ): Promise<void> {
    // Update DB
    await this.db
      .update(importLogs)
      .set({ status, errors: JSON.stringify(errors) })
      .where(eq(importLogs.id, logId));

    // Update Redis
    if (isRedisAvailable()) {
      const progress: Record<string, unknown> = {
        status,
        errors,
        result
      };

      if (status === 'success') {
        progress.current = 100;
        progress.total = 100;
      }

      const old = await importCache.getProgress(logId);
      await importCache.setProgress(logId, {
        current: old?.current || 0,
        total: old?.total || 0,
        ...progress
      } as ImportProgress);
    }
  }
}
