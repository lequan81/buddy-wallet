/**
 * Confirmed State
 *
 * Debt has been acknowledged by both parties.
 * Can transition to: paid, disputed
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '@/types';
import { DEBT_STATUS } from '@repo/config';
import type { IDebtState, TransitionContext } from '@/types/debt.d';
import { log } from '@repo/logger';

export class ConfirmedState implements IDebtState {
  readonly status: DebtStatus = DEBT_STATUS.CONFIRMED;

  private readonly validTransitions: DebtStatus[] = [DEBT_STATUS.PAID, DEBT_STATUS.DISPUTED];

  canTransitionTo(targetStatus: DebtStatus, _debt: Debt, _context: TransitionContext): boolean {
    return this.validTransitions.includes(targetStatus);
  }

  getValidTransitions(): DebtStatus[] {
    return [...this.validTransitions];
  }

  async onEnter(debt: Debt, context: TransitionContext): Promise<void> {
    log.info('DEBT_STATE', `Debt ${debt.id} confirmed`, {
      debtId: debt.id,
      userId: context.userId,
      amount: debt.amount,
      previousStatus: context.previousStatus
    });

    // Send notification to the creator (or counterparty based on who confirmed)
    const notifyUserId = context.userId === debt.creditorId ? debt.debtorId : debt.creditorId;
    if (notifyUserId) {
      import('../services').then(({ PushService, UserService }) => {
        UserService.getUserById(context.userId).then((confirmer) => {
          UserService.getUserById(notifyUserId).then((target) => {
            if (confirmer.user && target.user?.pushNotificationsEnabled) {
              PushService.sendDebtConfirmedNotification({
                userId: notifyUserId,
                confirmerName: confirmer.user.name,
                amount: debt.amount,
                description: debt.description || '',
                debtId: debt.id
              }).catch(() => {});
            }
          });
        });
      });
    }
  }

  async onExit(debt: Debt, context: TransitionContext): Promise<void> {
    log.info('DEBT_STATE', `Debt ${debt.id} exiting confirmed state`, {
      debtId: debt.id,
      userId: context.userId,
      newStatus: context.newStatus
    });
  }

  validate(_debt: Debt, _context: TransitionContext): { valid: boolean; error?: string } {
    return { valid: true };
  }
}
