/**
 * Confirmed State
 *
 * Debt has been acknowledged by both parties.
 * Can transition to: paid, disputed
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '../types';
import type { IDebtState, TransitionContext } from '../types/debt-state';
import { log } from '@repo/logger';

export class ConfirmedState implements IDebtState {
  readonly status: DebtStatus = 'confirmed';

  private readonly validTransitions: DebtStatus[] = ['paid', 'disputed'];

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

    // TODO: Send notification to both parties
    // await notificationService.sendDebtConfirmed(debt);
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
