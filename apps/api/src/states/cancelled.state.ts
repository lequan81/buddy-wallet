/**
 * Cancelled State (Terminal)
 *
 * Debt has been cancelled. This is a terminal state.
 * Cannot transition to any other state.
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '@/types';
import { DEBT_STATUS } from '@repo/config';
import type { IDebtState, TransitionContext } from '@/types/debt.d';
import { log } from '@repo/logger';

export class CancelledState implements IDebtState {
  readonly status: DebtStatus = DEBT_STATUS.CANCELLED;

  canTransitionTo(_targetStatus: DebtStatus, _debt: Debt, _context: TransitionContext): boolean {
    // Terminal state - no transitions allowed
    return false;
  }

  getValidTransitions(): DebtStatus[] {
    return []; // Terminal state
  }

  async onEnter(debt: Debt, context: TransitionContext): Promise<void> {
    log.info('DEBT_STATE', `Debt ${debt.id} CANCELLED`, {
      debtId: debt.id,
      userId: context.userId,
      amount: debt.amount,
      reason: context.reason,
      previousStatus: context.previousStatus
    });

    // Send cancellation notice to counterparty
    const notifyUserId = context.userId === debt.creditorId ? debt.debtorId : debt.creditorId;
    if (notifyUserId) {
      import('../services').then(({ PushService, UserService }) => {
        UserService.getUserById(context.userId).then((canceller) => {
          UserService.getUserById(notifyUserId).then((target) => {
            if (canceller.user && target.user?.pushNotificationsEnabled) {
              const amount = new Intl.NumberFormat('vi-VN', {
                style: 'currency',
                currency: 'VND',
                maximumFractionDigits: 0
              }).format(debt.amount);

              PushService.sendToUser(notifyUserId, {
                title: 'Debt Cancelled',
                body: `${canceller.user.name} has cancelled the debt of ${amount} for "${debt.description}".`,
                url: `/debts/${debt.id}`,
                tag: `debt-cancelled-${debt.id}`
              }).catch(() => {});
            }
          });
        });
      });
    }
  }

  // No onExit - terminal state cannot be exited

  validate(_debt: Debt, _context: TransitionContext): { valid: boolean; error?: string } {
    return { valid: true };
  }
}
