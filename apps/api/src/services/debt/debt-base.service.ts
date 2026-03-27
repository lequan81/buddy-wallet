/**
 * Debt Service Base Class
 * 
 * Provides shared helper methods for all debt services:
 * - getDebtOrFail: Fetch debt or return error
 * - validateAmount: Amount bounds validation
 * - notifyUser: Push notification helper
 * - logActivity: Activity logging helper
 * 
 * This eliminates code duplication across DebtCrudService, DebtStatusService, DebtBatchService.
 */
import {
  debts,
  eq,
  and,
  isNull,
  type ActivityAction
} from '@repo/db';
import { DEBT_MIN_AMOUNT, DEBT_MAX_AMOUNT } from '@repo/config';
import { logger } from '@repo/logger';
import type { DbClient } from '@/types';
import type { DebtResult } from '@/types';
import type { PushService } from '@services/push.service';
import type { ActivityService } from '@services/activity.service';
import { toDebtDetails } from '@services/debt/debt.utils';

import type { PushPayload } from '@/types/debt.d';

/** Database query result type (flexible for Drizzle ORM) */
export type DatabaseResult = {
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  debtorPhone: string;
  creditorPhone: string;
  debtorId: string | null;
  creditorId: string | null;
  uploadedById: string;
  amount: number;
  description: string | null;
  status: string;
  needsConfirmation: boolean;
  confirmedByCreditor: boolean | null;
  confirmedByDebtor: boolean | null;
  creditorConfirmedAt: Date | string | null;
  debtorConfirmedAt: Date | string | null;
  hasPendingProof: boolean;
  proofCount: number;
  lastProofUploadedAt: Date | string | null;
  expiresAt: Date | string | null;
  suggestedAmount: number | null;
  suggestedDescription: string | null;
  suggestedById: string | null;
  suggestedAt: Date | string | null;
  deletedAt: Date | string | null;
};

/** Drizzle update operation type (flexible for ORM compatibility) */
export type DrizzleUpdate<T = Record<string, unknown>> = T;

/**
 * DebtServiceBase - Shared helper methods for debt services
 * 
 * Uses OOP inheritance pattern to consolidate redundant declarations.
 * Child classes extend this base to access protected helpers.
 */
export abstract class DebtServiceBase {
  constructor(
    protected db: DbClient,
    protected pushService: PushService | null = null,
    protected activityService: ActivityService | null = null
  ) {}

  // ── Protected Helpers ──────────────────────────────────────────────

  /** Fetch a debt by ID or return a NOT_FOUND error */
  protected async getDebtOrFail(debtId: string): Promise<[DatabaseResult, null] | [null, DebtResult]> {
    const debt = await this.db.query.debts.findFirst({
      where: and(eq(debts.id, debtId), isNull(debts.deletedAt))
    });
    if (!debt) return [null, { success: false, error: 'Debt not found', code: 'NOT_FOUND' }];
    return [debt, null];
  }

  /** Validate amount bounds, returns error result or null */
  protected validateAmount(amount: number): DebtResult | null {
    if (amount < DEBT_MIN_AMOUNT) {
      return {
        success: false,
        error: `Minimum debt amount is ${DEBT_MIN_AMOUNT}`,
        code: 'AMOUNT_TOO_LOW'
      };
    }
    if (amount > DEBT_MAX_AMOUNT) {
      return {
        success: false,
        error: `Maximum debt amount is ${DEBT_MAX_AMOUNT}`,
        code: 'AMOUNT_TOO_HIGH'
      };
    }
    return null;
  }

  /** Send push notification (fire-and-forget, never throws) */
  protected async notifyUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.pushService) return;
    try {
      await this.pushService.sendToUser(userId, payload);
    } catch (error) {
      logger.error('Failed to send notification', { error: String(error) });
    }
  }

  /** Log an activity event (fire-and-forget) */
  protected async logActivity(
    userId: string,
    action: ActivityAction,
    resourceId?: string,
    changes?: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.activityService) return;
    await this.activityService.log({
      userId,
      action,
      resource: 'debt',
      ...(resourceId && { resourceId }),
      ...(changes && { changes }),
      ...(metadata && { metadata })
    });
  }

  /** Map debt entity to details DTO - handles nullable description field */
  protected toDetails = (debt: DatabaseResult) => {
    // Helper function to convert to Date or keep Date
    const toDate = (date: unknown): Date | null => {
      if (date instanceof Date) {
        return date;
      }
      if (typeof date === 'string') {
        return new Date(date);
      }
      return null;
    };

    // Convert database result to proper Debt type format with Date objects
    const convertedDebt = {
      id: debt.id,
      debtorPhone: debt.debtorPhone,
      creditorPhone: debt.creditorPhone,
      debtorId: debt.debtorId,
      creditorId: debt.creditorId,
      uploadedById: debt.uploadedById,
      amount: debt.amount,
      description: debt.description || '', // Ensure never null
      status: debt.status,
      needsConfirmation: debt.needsConfirmation,
      confirmedByCreditor: debt.confirmedByCreditor,
      confirmedByDebtor: debt.confirmedByDebtor,
      creditorConfirmedAt: toDate(debt.creditorConfirmedAt),
      debtorConfirmedAt: toDate(debt.debtorConfirmedAt),
      hasPendingProof: debt.hasPendingProof,
      proofCount: debt.proofCount,
      lastProofUploadedAt: toDate(debt.lastProofUploadedAt),
      expiresAt: toDate(debt.expiresAt),
      suggestedAmount: debt.suggestedAmount,
      suggestedDescription: debt.suggestedDescription,
      suggestedById: debt.suggestedById,
      suggestedAt: toDate(debt.suggestedAt),
      deletedAt: toDate(debt.deletedAt),
      createdAt: toDate(debt.createdAt) || new Date(), // Add missing createdAt
      updatedAt: toDate(debt.updatedAt) || new Date(), // Add missing updatedAt
    };
    
    return toDebtDetails(convertedDebt as unknown as Parameters<typeof toDebtDetails>[0]);
  };
}
