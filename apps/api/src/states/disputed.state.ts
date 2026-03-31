/**
 * Disputed State
 *
 * Debt is being contested by one party.
 * Can transition to: pending, confirmed, cancelled
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '@/types';
import { DEBT_STATUS } from '@repo/config';
import type { IDebtState, TransitionContext } from '@/types/debt.d';
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
      import('../services').then(({ PushService, UserService }) => {
        UserService.getUserById(context.userId).then((disputer) => {
          UserService.getUserById(notifyUserId).then((target) => {
            if (disputer.user && target.user?.pushNotificationsEnabled) {
              const amount = new Intl.NumberFormat('vi-VN', {
                style: 'currency',
                currency: 'VND',
                maximumFractionDigits: 0
              }).format(debt.amount);

              PushService.sendToUser(notifyUserId, {
                title: 'Debt Disputed',
                body: `${disputer.user.name} has disputed the debt of ${amount} for "${debt.description}". Reason: ${context.reason || 'No reason provided'}`,
                url: `/debts/${debt.id}`,
                tag: `debt-disputed-${debt.id}`
              }).catch(() => {});
            }
          });
        });
      });
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
