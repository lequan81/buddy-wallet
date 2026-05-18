/**
 * JWT Blacklist Cache Module
 */
import { cache } from '../cache';
import { env } from '@repo/config';

const JWT_BLACKLIST_TTL = env.int('REDIS_JWT_BLACKLIST_TTL', 604800);

export const jwtBlacklist = {
  async add(tokenHash: string, expiresInSeconds: number = JWT_BLACKLIST_TTL) {
    return cache.set(`jwt:blacklist:${tokenHash}`, true, expiresInSeconds);
  },

  async isBlacklisted(tokenHash: string): Promise<boolean> {
    const result = await cache.get<boolean>(`jwt:blacklist:${tokenHash}`);
    return result === true;
  },

  async remove(tokenHash: string) {
    return cache.del(`jwt:blacklist:${tokenHash}`);
  }
};
