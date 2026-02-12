/**
 * JWT Blacklist Cache Module
 */
import { hashToken } from '../../../utils';
import { cache } from '../../../plugins/redis/cache';

const JWT_BLACKLIST_TTL = parseInt(Bun.env.REDIS_JWT_BLACKLIST_TTL || '604800');

export const jwtBlacklist = {
  async add(token: string, expiresInSeconds: number = JWT_BLACKLIST_TTL) {
    const hashed = await hashToken(token);
    return cache.set(`jwt:blacklist:${hashed}`, true, expiresInSeconds);
  },

  async isBlacklisted(token: string): Promise<boolean> {
    const hashed = await hashToken(token);
    const result = await cache.get<boolean>(`jwt:blacklist:${hashed}`);
    return result === true;
  },

  async remove(token: string) {
    const hashed = await hashToken(token);
    return cache.del(`jwt:blacklist:${hashed}`);
  }
};
