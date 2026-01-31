/**
 * Import Progress Cache Module
 */
import { cache } from '@plugins/redis/cache';

const IMPORT_PROGRESS_TTL = parseInt(Bun.env.REDIS_IMPORT_TTL || '3600');

export interface ImportProgress {
  current: number;
  total: number;
  status: string;
  errors?: string[];
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

  async del(logId: string) {
    return cache.del(`import:${logId}`);
  }
};
