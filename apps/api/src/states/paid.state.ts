/**
 * Paid State (Terminal)
 *
 * Debt has been fully paid. This is a terminal state.
 * Cannot transition to any other state.
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '@/types';
import { DEBT_STATUS } from '@repo/config';
import type { IDebtState, TransitionContext } from './types';
import { log } from '@repo/logger';

export class PaidState implements IDebtState {
  readonly status: DebtStatus = DEBT_STATUS.PAID;

  canTransitionTo(_targetStatus: DebtStatus, _debt: Debt, _context: TransitionContext): boolean {
    // Terminal state - no transitions allowed
    return false;
  }

  getValidTransitions(): DebtStatus[] {
    return []; // Terminal state
  }

  async onEnter(debt: Debt, context: TransitionContext): Promise<void> {
    log.info('DEBT_STATE', `Debt ${debt.id} marked as PAID`, {
      debtId: debt.id,
      userId: context.userId,
      amount: debt.amount,
      previousStatus: context.previousStatus
    });

    // Send notification to the counterparty (fire-and-forget with error logging)
    const notifyUserId = context.userId === debt.creditorId ? debt.debtorId : debt.creditorId;
    if (notifyUserId) {
      this.notifyCounterparty(debt, notifyUserId).catch((error) => {
        log.error('DEBT_NOTIFICATION_FAILED', String(error), {
          debtId: debt.id,
          notifyUserId
        });
      });
    }
  }

  private async notifyCounterparty(debt: Debt, userId: string): Promise<void> {
    try {
      const { services } = await import('../plugins/di/services.plugin');
      const result = await services.userService.getUserById(userId);

      if (result.user?.pushNotificationsEnabled) {
        const amount = new Intl.NumberFormat('vi-VN', {
          style: 'currency',
          currency: 'VND',
          maximumFractionDigits: 0
        }).format(debt.amount);

        await services.pushService.sendToUser(userId, {
          title: 'Debt Paid',
          body: `A debt of ${amount} for "${debt.description}" has been marked as paid.`,
          url: `/debts/${debt.id}`,
          tag: `debt-paid-${debt.id}`
        });
      }
    } catch (error) {
      throw new Error(`Failed to notify user ${userId}: ${String(error)}`);
    }
  }

  // No onExit - terminal state cannot be exited

  validate(_debt: Debt, _context: TransitionContext): { valid: boolean; error?: string } {
    return { valid: true };
  }
}
