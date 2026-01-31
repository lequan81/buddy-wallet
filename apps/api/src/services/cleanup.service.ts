/**
 * Cleanup Service
 *
 * Handles database cleanup operations for stale data.
 * Can be used by the API scheduler or standalone worker script.
 */
import { db, importLogs, sessions, eq, and, lte } from '@repo/db';
import { log } from '@utils/logger';

export const cleanupService = {
  /**
   * Cleanup stale pending import logs (older than 24 hours)
   */
  async cleanupStalePendingLogs(): Promise<{ deleted: number }> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Delete pending logs older than 24 hours
      const result = await db
        .delete(importLogs)
        .where(and(eq(importLogs.status, 'pending'), lte(importLogs.createdAt, oneDayAgo)));

      log.info('CLEANUP', 'Removed stale pending import logs (>24h)');
      return { deleted: 0 }; // SQLite doesn't return affected rows easily
    } catch (err) {
      log.error('CLEANUP', 'Failed to clean import logs', { error: String(err) });
      return { deleted: 0 };
    }
  },

  /**
   * Cleanup expired sessions (soft-deleted > 24h ago)
   */
  async cleanupExpiredSessions(): Promise<{ deleted: number }> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Hard delete sessions that were revoked more than 24 hours ago
      await db
        .delete(sessions)
        .where(and(eq(sessions.status, 'revoked'), lte(sessions.revokedAt, oneDayAgo)));

      // Also delete logged_out sessions older than 24h
      await db
        .delete(sessions)
        .where(and(eq(sessions.status, 'logged_out'), lte(sessions.revokedAt, oneDayAgo)));

      // Delete expired sessions older than 24h
      await db
        .delete(sessions)
        .where(and(eq(sessions.status, 'expired'), lte(sessions.refreshTokenExpiresAt, oneDayAgo)));

      log.info('CLEANUP', 'Removed expired/revoked sessions (>24h)');
      return { deleted: 0 };
    } catch (err) {
      log.error('CLEANUP', 'Failed to clean sessions', { error: String(err) });
      return { deleted: 0 };
    }
  },

  /**
   * Run all cleanup tasks
   */
  async runAll(): Promise<void> {
    log.info('CLEANUP', 'Starting cleanup tasks...');
    await this.cleanupStalePendingLogs();
    await this.cleanupExpiredSessions();
    log.info('CLEANUP', 'Cleanup tasks completed.');
  }
};
