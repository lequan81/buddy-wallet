/**
 * Confirmed State
 *
 * Debt has been acknowledged by both parties.
 * Can transition to: paid, disputed
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '@/types';
import { DEBT_STATUS } from '@repo/config';
import type { IDebtState, TransitionContext } from './types';
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
      this.notifyCounterparty(debt, context.userId, notifyUserId).catch((error) => {
        log.error('DEBT_NOTIFICATION_FAILED', String(error), {
          debtId: debt.id,
          notifyUserId
        });
      });
    }
  }

  private async notifyCounterparty(debt: Debt, confirmerId: string, notifyUserId: string): Promise<void> {
    try {
      const { services } = await import('../plugins/di/services.plugin');
      const confirmer = await services.userService.getUserById(confirmerId);
      const target = await services.userService.getUserById(notifyUserId);

      if (confirmer.user && target.user?.pushNotificationsEnabled) {
        await services.pushService.sendDebtConfirmedNotification({
          userId: notifyUserId,
          confirmerName: confirmer.user.name,
          amount: debt.amount,
          description: debt.description || '',
          debtId: debt.id
        });
      }
    } catch (error) {
      throw new Error(`Failed to notify user ${notifyUserId}: ${String(error)}`);
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
