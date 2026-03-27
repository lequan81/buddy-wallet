/**
 * Debt Batch Service
 * 
 * Handles batch operations on debts:
 * - Soft delete multiple debts
 * - Delete all debts for a user
 * 
 * Extends DebtServiceBase for shared helpers (OOP inheritance).
 * Dependencies: db, activityService
 */
import {
  debts,
  eq
} from '@repo/db';
import { hasPermission, PERMISSIONS } from '@repo/permissions';
import {
  MAX_BATCH_DELETE_SIZE
} from '@repo/config';
import type { DbClient } from '@/types';
import type { CurrentUser } from '@/types';
import type { PushService } from '@services/push.service';
import type { ActivityService } from '@services/activity.service';
import { DebtServiceBase } from '@services/debt/debt-base.service';

/**
 * DebtBatchService - Batch operations for debts
 * Extends DebtServiceBase for shared validation helpers
 */
export class DebtBatchService extends DebtServiceBase {
  constructor(
    db: DbClient,
    pushService: PushService | null = null,
    activityService: ActivityService | null = null
  ) {
    super(db, pushService, activityService);
  }

  // ── Batch Operations ─────────────────────────────────────────────

  /**
   * Soft delete multiple debts
   */
  async deleteDebts(
    debtIds: string[],
    currentUser: CurrentUser
  ): Promise<{ success: boolean; deleted: number; errors: string[] }> {
    const errors: string[] = [];
    let deletedCount = 0;

    if (debtIds.length > MAX_BATCH_DELETE_SIZE) {
      return {
        success: false,
        deleted: 0,
        errors: [`Maximum ${MAX_BATCH_DELETE_SIZE} debts can be deleted at once`]
      };
    }

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_DELETE_ALL);
    const now = new Date();

    // Use transaction for batch delete
    await this.db.transaction(async (tx) => {
      for (const debtId of debtIds) {
        const debt = await tx.query.debts.findFirst({ where: eq(debts.id, debtId) });

        if (!debt) {
          errors.push(`Debt ${debtId} not found`);
          continue;
        }

        if (!isAdmin && debt.uploadedById !== currentUser.id) {
          errors.push(`Not authorized to delete debt ${debtId}`);
          continue;
        }

        await tx
          .update(debts)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(debts.id, debtId));
        deletedCount++;
      }

      // Log activity within transaction
      if (deletedCount > 0) {
        await this.logActivity(
          currentUser.id,
          'delete',
          undefined,
          undefined,
          { deletedCount, ids: debtIds }
        );
      }
    });

    return { success: errors.length === 0, deleted: deletedCount, errors };
  }

  /**
   * Delete all debts for a user
   */
  async deleteAllDebts(userId: string): Promise<{ success: boolean; deleted: number }> {
    const userDebts = await this.db.query.debts.findMany({
      where: eq(debts.uploadedById, userId)
    });

    if (userDebts.length === 0) return { success: true, deleted: 0 };

    const now = new Date();
    await this.db
      .update(debts)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(debts.uploadedById, userId));

    return { success: true, deleted: userDebts.length };
  }
}
