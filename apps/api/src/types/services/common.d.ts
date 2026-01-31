/**
 * Common Service Types
 */
import type { db } from '@repo/db';

/**
 * Type alias for the Drizzle database client
 */
export type DbClient = typeof db;

/**
 * JWT interface for token signing
 */
export interface JwtService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sign: (payload: any) => Promise<string>;
}

/**
 * Redis cache interface
 */
export interface CacheService {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
}
