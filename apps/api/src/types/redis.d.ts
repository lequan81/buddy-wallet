/**
 * Redis Cache Type Definitions
 */

export interface CacheStats {
  dailyCommands: number;
  limit: number;
  failureCount: number;
}

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean>;
  del(key: string): Promise<boolean>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
  ttl(key: string): Promise<number>;
  getStats(): CacheStats;
}

export interface SessionCacheData {
  user: Record<string, unknown>;
  sessionId: string;
}

export interface SessionCache {
  set(sessionId: string, data: Record<string, unknown>, ttlSeconds?: number): Promise<boolean>;
  get(sessionId: string): Promise<Record<string, unknown> | null>;
  del(sessionId: string): Promise<boolean>;
}

/**
 * Cache key prefixes for different use cases
 */
export type CacheKeyPrefix =
  | 'session'      // Session data cache
  | 'ratelimit'    // Rate limiting counters
  | 'user'         // User profile cache
  | 'jwt'          // JWT blacklist/validation
  | 'import'       // Import progress/status
  | 'export'       // Export job status
  | 'permission';  // Permission cache
