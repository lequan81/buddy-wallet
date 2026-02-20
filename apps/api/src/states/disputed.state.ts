/**
 * Disputed State
 *
 * Debt is being contested by one party.
 * Can transition to: pending, confirmed, cancelled
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '../types';
import type { IDebtState, TransitionContext } from '../types/debt-state';
import { log } from '@repo/logger';

export class DisputedState implements IDebtState {
  readonly status: DebtStatus = 'disputed';

  private readonly validTransitions: DebtStatus[] = ['pending', 'confirmed', 'cancelled'];

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

    // TODO: Send notification to both parties about dispute
    // await notificationService.sendDebtDisputed(debt, context.reason);
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
