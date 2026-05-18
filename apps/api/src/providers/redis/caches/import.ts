/**
 * Import Progress Cache Module
 */
import { cache } from '../cache';
import { env } from '@repo/config';

const IMPORT_PROGRESS_TTL = env.int('REDIS_IMPORT_TTL', 3600);

export interface ImportProgress {
  current: number;
  total: number;
  status: string;
  result?: unknown;
  errors?: string[];
  message?: string;
}

export const importCache = {
  async setProgress(
    logId: string,
    progress: ImportProgress,
    ttlSeconds: number = IMPORT_PROGRESS_TTL
  ) {
    return cache.set(`import:${logId}`, progress, ttlSeconds);
  },

  async getProgress(logId: string) {
    return cache.get<ImportProgress>(`import:${logId}`);
  },

  async getProgressBatch(logIds: string[]) {
    return cache.mget<ImportProgress>(logIds.map(id => `import:${id}`));
  },

  async del(logId: string) {
    return cache.del(`import:${logId}`);
  }
};

