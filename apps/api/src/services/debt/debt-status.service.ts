/**
 * Debt Status Service
 * 
 * Handles debt status management and state transitions:
 * - Confirm debt (by counterparty)
 * - Update debt status with state machine validation
 * - Suggest edits (by counterparty)
 * - Respond to suggestions (by creator)
 * 
 * Extends DebtServiceBase for shared helpers (OOP inheritance).
 * Dependencies: db, pushService, activityService
 */
import {
  debts,
  eq,
  type Debt,
  type ActivityAction
} from '@repo/db';
import { hasPermission, PERMISSIONS } from '@repo/permissions';
import { debtStateMachine } from '../../states';
import { logger } from '@repo/logger';
import type { DbClient } from '@/types';
import type { DebtStatus, DebtResult, StatusUpdateResult } from '@/types';
import type { CurrentUser } from '@/types';
import type { PushService } from '@services/push.service';
import type { ActivityService } from '@services/activity.service';
import { DEBT_STATUS } from '@repo/types';
import { DebtServiceBase, type DrizzleUpdate } from '@services/debt/debt-base.service';

/**
 * DebtStatusService - Status management and suggestion handling
 * Extends DebtServiceBase for shared validation and notification helpers
 */
export class DebtStatusService extends DebtServiceBase {
  constructor(
    db: DbClient,
    pushService: PushService | null = null,
    activityService: ActivityService | null = null
  ) {
    super(db, pushService, activityService);
  }

  // ── Status Management ────────────────────────────────────────────

  /**
   * Confirm a debt by counterparty
   * Only the counterparty (not the creator) can confirm
   */
  async confirmDebt(debtId: string, currentUser: CurrentUser): Promise<DebtResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isCreditor = debt.creditorId === currentUser.id;
    const isDebtor = debt.debtorId === currentUser.id;

    if (!isCreditor && !isDebtor) {
      return { success: false, error: 'You are not involved in this debt', code: 'FORBIDDEN' };
    }

    if (debt.uploadedById === currentUser.id) {
      return {
        success: false,
        error: 'You created this debt and have already confirmed it. Waiting for counterparty confirmation.',
        code: 'ALREADY_CONFIRMED'
      };
    }

    if ((isCreditor && debt.confirmedByCreditor) || (isDebtor && debt.confirmedByDebtor)) {
      return { success: true, debt: this.toDetails(debt), message: 'You already confirmed this debt' };
    }

    const now = new Date();
    const updates: Partial<typeof debt> = { updatedAt: now };

    if (isCreditor) {
      updates.confirmedByCreditor = true;
      updates.creditorConfirmedAt = now;
    }
    if (isDebtor) {
      updates.confirmedByDebtor = true;
      updates.debtorConfirmedAt = now;
    }

    const willBeFullyConfirmed =
      (updates.confirmedByCreditor || debt.confirmedByCreditor) &&
      (updates.confirmedByDebtor || debt.confirmedByDebtor);
    if (willBeFullyConfirmed) updates.needsConfirmation = false;

    // Use transaction for atomic update + activity logging
    const updatedDebt = await this.db.transaction(async (tx) => {
      await tx.update(debts).set(updates as DrizzleUpdate).where(eq(debts.id, debtId));
      const result = await tx.query.debts.findFirst({ where: eq(debts.id, debtId) });
      
      await this.logActivity(
        currentUser.id,
        'confirm',
        debtId
      );
      
      return result;
    });

    // Send notification outside transaction (non-critical)
    if (this.pushService && debt.uploadedById) {
      try {
        await this.pushService.sendDebtConfirmedNotification({
          userId: debt.uploadedById as string,
          confirmerName: currentUser.phoneNumber || 'Counterparty',
          amount: debt.amount as number,
          description: (debt.description as string) || 'No description',
          debtId
        });
      } catch (error) {
        logger.error('Failed to send confirmation notification', { error: String(error) });
      }
    }

    return { success: true, debt: updatedDebt ? this.toDetails(updatedDebt) : undefined, message: 'Debt confirmed successfully' };
  }

  /**
   * Update debt status with transition validation
   * Uses State Machine pattern for OCP compliance
   */
  async updateDebtStatus(
    debtId: string,
    newStatus: DebtStatus,
    currentUser: CurrentUser
  ): Promise<StatusUpdateResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_VIEW_ALL);
    const isInvolved = debt.debtorId === currentUser.id || debt.creditorId === currentUser.id;
    if (!isAdmin && !isInvolved) {
      return { success: false, error: 'You are not a party to this debt' };
    }

    const now = new Date();
    const transitionResult = await debtStateMachine.transition(debt as Debt, newStatus, {
      userId: currentUser.id,
      permissions: currentUser.permissions,
      timestamp: now
    });

    if (!transitionResult.success) {
      return {
        success: false,
        error: transitionResult.error,
        code: transitionResult.code,
        validTransitions: transitionResult.validTransitions
      };
    }

    // Use transaction for atomic status update + activity logging
    const updatedDebt = await this.db.transaction(async (tx) => {
      await tx
        .update(debts)
        .set({ status: newStatus, updatedAt: now } as DrizzleUpdate)
        .where(eq(debts.id, debtId));
      const result = await tx.query.debts.findFirst({ where: eq(debts.id, debtId) });
      
      await this.logActivity(
        currentUser.id,
        newStatus as ActivityAction,
        debtId,
        { before: { status: debt.status }, after: { status: newStatus } }
      );
      
      return result;
    });

    return { success: true, debt: updatedDebt ? this.toDetails(updatedDebt) : undefined, previousStatus: debt.status as DebtStatus, newStatus };
  }

  // ── Suggestion Methods ─────────────────────────────────────────

  /**
   * Suggest an edit to a debt (counterparty can suggest changes)
   */
  async suggestEdit(
    debtId: string,
    currentUser: CurrentUser,
    suggestion: { amount?: number; description?: string }
  ): Promise<DebtResult> {
    // VALIDATE INPUTS FIRST (Fail-Fast)
    if (!suggestion.amount && !suggestion.description) {
      return {
        success: false,
        error: 'Must provide at least amount or description to suggest',
        code: 'VALIDATION_ERROR'
      };
    }

    if (suggestion.amount !== undefined) {
      const amountErr = this.validateAmount(suggestion.amount);
      if (amountErr) return amountErr;
    }

    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isCreditor = debt.creditorId === currentUser.id;
    const isDebtor = debt.debtorId === currentUser.id;

    if (!isCreditor && !isDebtor) {
      return { success: false, error: 'You are not involved in this debt', code: 'FORBIDDEN' };
    }
    if (debt.uploadedById === currentUser.id) {
      return {
        success: false,
        error: 'Creators cannot suggest edits to their own debts',
        code: 'FORBIDDEN'
      };
    }
    if (debt.status === DEBT_STATUS.PAID || debt.status === DEBT_STATUS.CANCELLED) {
      return {
        success: false,
        error: 'Cannot suggest edits to completed debts',
        code: 'INVALID_STATE'
      };
    }

    const now = new Date();

    // Use transaction for atomic suggestion update
    const updatedDebt = await this.db.transaction(async (tx) => {
      await tx
        .update(debts)
        .set({
          suggestedAmount: suggestion.amount ?? null,
          suggestedDescription: suggestion.description ?? null,
          suggestedById: currentUser.id,
          suggestedAt: now,
          updatedAt: now
        } as DrizzleUpdate)
        .where(eq(debts.id, debtId));
      
      return await tx.query.debts.findFirst({ where: eq(debts.id, debtId) });
    });

    // Send notification outside transaction (non-critical)
    if (debt.uploadedById) {
      await this.notifyUser(debt.uploadedById as string, {
        title: 'Edit Suggested',
        body: `Someone suggested changes to your debt of ${(debt.amount as number).toLocaleString()} VND`,
        url: `/debts/${debtId}`
      });
    }

    return { success: true, debt: updatedDebt ? this.toDetails(updatedDebt) : undefined, message: 'Edit suggestion sent' };
  }

  /**
   * Accept or reject a suggested edit
   */
  async respondToSuggestion(
    debtId: string,
    currentUser: CurrentUser,
    accept: boolean
  ): Promise<DebtResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    if (debt.uploadedById !== currentUser.id) {
      return {
        success: false,
        error: 'Only the creator can respond to edit suggestions',
        code: 'FORBIDDEN'
      };
    }
    if (!debt.suggestedById) {
      return { success: false, error: 'No pending suggestion', code: 'INVALID_STATE' };
    }

    const now = new Date();
    const clearSuggestion = {
      suggestedAmount: null,
      suggestedDescription: null,
      suggestedById: null,
      suggestedAt: null,
      updatedAt: now
    };
    const updates = accept
      ? {
          ...clearSuggestion,
          amount: debt.suggestedAmount ?? debt.amount,
          description: debt.suggestedDescription ?? debt.description
        }
      : clearSuggestion;

    // Use transaction for atomic suggestion response
    const updatedDebt = await this.db.transaction(async (tx) => {
      await tx.update(debts).set(updates as DrizzleUpdate).where(eq(debts.id, debtId));
      return await tx.query.debts.findFirst({ where: eq(debts.id, debtId) });
    });

    // Send notification outside transaction (non-critical)
    if (debt.suggestedById) {
      await this.notifyUser(debt.suggestedById as string, {
        title: accept ? 'Edit Accepted' : 'Edit Rejected',
        body: accept ? 'Your suggested edit was accepted' : 'Your suggested edit was rejected',
        url: `/debts/${debtId}`
      });
    }

    return {
      success: true,
      debt: updatedDebt ? this.toDetails(updatedDebt) : undefined,
      message: accept ? 'Suggestion accepted' : 'Suggestion rejected'
    };
  }
}
