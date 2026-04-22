/**
 * Common Service Types
 */
import type { db } from '@repo/db';

/**
 * Type alias for the Drizzle database client
 */
export type DbClient = typeof db;


/**
 * Redis cache interface
 */
export interface CacheService {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
}




