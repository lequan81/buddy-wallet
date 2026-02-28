/**
 * Cleanup Service
 *
 * Handles database cleanup operations for stale data.
 * Can be used by the API scheduler or standalone worker script.
 */
import {
  db,
  importLogs,
  sessions,
  debts,
  users,
  emailVerifications,
  eq,
  and,
  or,
  lte,
  ne,
  not,
  isNull
} from '@repo/db';
import { log } from '@repo/logger';
import { PushService } from './index';

import { formatVND } from '@repo/utils';

export const CleanupService = {
  /**
   * Cleanup stale processing logs (zombies > 3 hours)
   * Marks them as failed instead of deleting, so user sees "Failed"
   */
  async cleanupStaleProcessingLogs(): Promise<{ updated: number }> {
    try {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

      // 1. Mark zombie jobs (processing/pending > 3 hours) as failed
      await db
        .update(importLogs)
        .set({
          status: 'failed',
          errors: JSON.stringify(['Job timed out (zombie worker > 3 hours)']),
          completedAt: new Date()
        })
        .where(
          and(
            or(eq(importLogs.status, 'processing'), eq(importLogs.status, 'pending')),
            lte(importLogs.createdAt, threeHoursAgo)
          )
        );

      // 2. Mark stalled jobs (processing > 1 hour without completing) as failed
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      await db
        .update(importLogs)
        .set({
          status: 'failed',
          errors: JSON.stringify(['Job progress stalled (processing > 1 hour without completing)']),
          completedAt: new Date()
        })
        .where(
          and(
            eq(importLogs.status, 'processing'),
            lte(importLogs.createdAt, oneHourAgo),
            isNull(importLogs.completedAt)
          )
        );

      log.info('CLEANUP', 'Marked stale/stalled processing logs as failed');
      return { updated: 0 }; // SQLite doesn't return affected rows easily
    } catch (err) {
      log.error('CLEANUP', 'Failed to clean processing logs', { error: String(err) });
      return { updated: 0 };
    }
  },

  /**
   * Cleanup stale pending import logs (older than 24 hours)
   */
  async cleanupStalePendingLogs(): Promise<{ deleted: number }> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await db
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

      // Mark active sessions older than 90 days as expired
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      await db
        .update(sessions)
        .set({ status: 'expired' })
        .where(and(eq(sessions.status, 'active'), lte(sessions.createdAt, ninetyDaysAgo)));

      log.info(
        'CLEANUP',
        'Removed expired/revoked sessions (>24h), marked stale active sessions as expired'
      );
      return { deleted: 0 };
    } catch (err) {
      log.error('CLEANUP', 'Failed to clean sessions', { error: String(err) });
      return { deleted: 0 };
    }
  },

  /**
   * Cancel debts that have passed their expiry date
   * Only affects debts with expiresAt set (not 'forever' debts)
   */
  async expireUnconfirmedDebts(): Promise<{ expired: number }> {
    try {
      const now = new Date();

      // Find all expired unconfirmed debts
      const expiredDebts = db
        .select()
        .from(debts)
        .where(
          and(
            eq(debts.needsConfirmation, true),
            not(isNull(debts.expiresAt)),
            lte(debts.expiresAt, now),
            ne(debts.status, 'cancelled'),
            ne(debts.status, 'paid')
          )
        )
        .all();

      if (expiredDebts.length === 0) {
        log.info('CLEANUP', 'No expired debts to cancel');
        return { expired: 0 };
      }

      // Cancel all expired debts
      await db
        .update(debts)
        .set({
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(debts.needsConfirmation, true),
            not(isNull(debts.expiresAt)),
            lte(debts.expiresAt, now),
            ne(debts.status, 'cancelled'),
            ne(debts.status, 'paid')
          )
        );

      log.info('CLEANUP', `Expired ${expiredDebts.length} unconfirmed debts`);

      // Send notifications to creators
      for (const debt of expiredDebts) {
        if (debt.uploadedById) {
          try {
            // Check if user can receive notifications
            const user = db.select().from(users).where(eq(users.id, debt.uploadedById)).get();
            if (user?.emailVerified && user?.pushNotificationsEnabled) {
              await PushService.sendToUser(debt.uploadedById, {
                title: 'Debt Expired',
                body: `Your debt of ${formatVND(debt.amount)} was auto-cancelled - confirmation period ended.`,
                url: `/debts/${debt.id}`
              });
            }
          } catch (_e) {
            // Ignore notification failures
          }
        }
      }

      return { expired: expiredDebts.length };
    } catch (err) {
      log.error('CLEANUP', 'Failed to expire debts', { error: String(err) });
      return { expired: 0 };
    }
  },

  /**
   * Cleanup expired OTP records (email verifications past expiresAt)
   */
  async cleanupExpiredOTPs(): Promise<{ deleted: number }> {
    try {
      const now = new Date();
      await db.delete(emailVerifications).where(lte(emailVerifications.expiresAt, now));

      log.info('CLEANUP', 'Removed expired OTP records');
      return { deleted: 0 };
    } catch (err) {
      log.error('CLEANUP', 'Failed to clean OTPs', { error: String(err) });
      return { deleted: 0 };
    }
  },

  /**
   * Run all cleanup tasks
   */
  async runAll(): Promise<void> {
    log.info('CLEANUP', 'Starting cleanup tasks...');
    await this.cleanupStaleProcessingLogs();
    await this.cleanupStalePendingLogs();
    await this.cleanupExpiredSessions();
    await this.cleanupExpiredOTPs();
    await this.expireUnconfirmedDebts();
    log.info('CLEANUP', 'Cleanup tasks completed.');
  }
};
