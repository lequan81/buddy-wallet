import { env } from '@repo/config';

export const cacheConfig = {
  VIETQR_TTL: env.int('CACHE_VIETQR_TTL', 24 * 60 * 60) // 24 hours
};
