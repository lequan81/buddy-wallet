import { injectable } from 'tsyringe';
import { isRedisAvailable, cache } from '@infra/Redis';
import { logger } from '@repo/logger';
import type { RateLimitEntry } from '@/app/Repositories/Contracts/Types/auth';

/**
 * RateLimitService - Manages rate limiting state across Redis and in-memory fallback
 */
@injectable()
export class RateLimitService {
  private inMemoryStore = new Map<string, RateLimitEntry>();
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Periodically cleanup in-memory store
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    // In Bun/Node environments, unref allows the process to exit even if the timer is active
    if ((this.cleanupInterval as any).unref) {
      (this.cleanupInterval as any).unref();
    }
  }

  /**
   * Increment attempt count for a key
   */
  async increment(key: string, windowSeconds: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    if (isRedisAvailable()) {
      const count = await cache.incr(key, windowSeconds);
      const ttls = await cache.ttl(key);
      const resetAt = now + (ttls > 0 ? ttls * 1000 : windowMs);
      return { count, resetAt };
    }

    // In-memory fallback
    let entry = this.inMemoryStore.get(key);
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 1,
        resetAt: now + windowMs
      };
      this.inMemoryStore.set(key, entry);
    } else {
      entry.count++;
    }

    return entry;
  }

  /**
   * Get current attempt count without incrementing
   */
  async getAttempts(key: string): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();

    if (isRedisAvailable()) {
      const countStr = await cache.get<string>(key);
      const count = countStr ? parseInt(countStr, 10) : 0;
      const ttls = await cache.ttl(key);
      const resetAt = now + (ttls > 0 ? ttls * 1000 : 0);
      return { count, resetAt };
    }

    const entry = this.inMemoryStore.get(key);
    if (!entry || entry.resetAt < now) {
      return { count: 0, resetAt: 0 };
    }

    return entry;
  }

  /**
   * Reset/clear rate limit for a key
   */
  async reset(key: string): Promise<void> {
    if (isRedisAvailable()) {
      await cache.del(key);
    }
    this.inMemoryStore.delete(key);
    logger.debug(`[RateLimitService] Reset key: ${key}`);
  }

  /**
   * Get reset time for a key
   */
  async getResetTime(key: string): Promise<number | null> {
    if (isRedisAvailable()) {
      const ttl = await cache.ttl(key);
      return ttl > 0 ? Date.now() + ttl * 1000 : null;
    }

    const entry = this.inMemoryStore.get(key);
    return entry?.resetAt || null;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.inMemoryStore.entries()) {
      if (entry.resetAt < now) {
        this.inMemoryStore.delete(key);
      }
    }
  }

  /**
   * Cleanup on service destruction
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
