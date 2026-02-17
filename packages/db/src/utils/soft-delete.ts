/**
 * Soft Delete Utilities
 *
 * Provides helper functions for the Two-Stage deletion pattern:
 * - Stage 1: Set deletedAt (record hidden from normal queries)
 * - Stage 2: Hard delete after retention period (by cleanup worker)
 */
import { isNull } from 'drizzle-orm';

/**
 * Default retention period before hard delete (30 days)
 */
export const SOFT_DELETE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * SQL fragment to filter out soft-deleted records
 * Usage: db.select().from(table).where(notDeleted(table.deletedAt))
 */
export function notDeleted<T>(deletedAtColumn: T) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return isNull(deletedAtColumn as any);
}

/**
 * Get the timestamp for hard delete eligibility
 * Records with deletedAt older than this should be hard deleted
 */
export function getHardDeleteThreshold(retentionMs: number = SOFT_DELETE_RETENTION_MS): Date {
  return new Date(Date.now() - retentionMs);
}
