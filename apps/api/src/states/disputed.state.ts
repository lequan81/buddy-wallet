/**
 * Disputed State
 *
 * Debt is being contested by one party.
 * Can transition to: pending, confirmed, cancelled
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '@/types';
import { DEBT_STATUS } from '@repo/config';
import type { IDebtState, TransitionContext } from './types';
import { log } from '@repo/logger';

export class DisputedState implements IDebtState {
  readonly status: DebtStatus = DEBT_STATUS.DISPUTED;

  private readonly validTransitions: DebtStatus[] = [
    DEBT_STATUS.PENDING,
    DEBT_STATUS.CONFIRMED,
    DEBT_STATUS.CANCELLED
  ];

  canTransitionTo(targetStatus: DebtStatus, _debt: Debt, _context: TransitionContext): boolean {
    return this.validTransitions.includes(targetStatus);
  }

  getValidTransitions(): DebtStatus[] {
    return [...this.validTransitions];
  }

  async onEnter(debt: Debt, context: TransitionContext): Promise<void> {
    log.warn('DEBT_STATE', `Debt ${debt.id} disputed`, {
      debtId: debt.id,
      userId: context.userId,
      amount: debt.amount,
      reason: context.reason,
      previousStatus: context.previousStatus
    });

    // Send notification to the counterparty about dispute
    const notifyUserId = context.userId === debt.creditorId ? debt.debtorId : debt.creditorId;
    if (notifyUserId) {
      this.notifyCounterparty(debt, context.userId, notifyUserId).catch((error) => {
        log.error('DEBT_NOTIFICATION_FAILED', String(error), {
          debtId: debt.id,
          notifyUserId
        });
      });
    }
  }

  private async notifyCounterparty(debt: Debt, disputerId: string, notifyUserId: string): Promise<void> {
    try {
      const { services } = await import('../plugins/di/services.plugin');
      const disputer = await services.userService.getUserById(disputerId);
      const target = await services.userService.getUserById(notifyUserId);

      if (disputer.user && target.user?.pushNotificationsEnabled) {
        const amount = new Intl.NumberFormat('vi-VN', {
          style: 'currency',
          currency: 'VND',
          maximumFractionDigits: 0
        }).format(debt.amount);

        await services.pushService.sendToUser(notifyUserId, {
          title: 'Debt Disputed',
          body: `${disputer.user.name} has disputed the debt of ${amount} for "${debt.description}".`,
          url: `/debts/${debt.id}`,
          tag: `debt-disputed-${debt.id}`
        });
      }
    } catch (error) {
      throw new Error(`Failed to notify user ${notifyUserId}: ${String(error)}`);
    }
  }

  async onExit(debt: Debt, context: TransitionContext): Promise<void> {
    log.info('DEBT_STATE', `Debt ${debt.id} dispute resolved`, {
      debtId: debt.id,
      userId: context.userId,
      newStatus: context.newStatus
    });
  }

  validate(_debt: Debt, _context: TransitionContext): { valid: boolean; error?: string } {
    return { valid: true };
  }
}
