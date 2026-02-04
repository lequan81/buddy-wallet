/**
 * Pending State
 *
 * Initial state for newly created debts.
 * Can transition to: confirmed, disputed, cancelled
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '@/types';
import type { IDebtState, TransitionContext } from '@/types/debt-state';
import { log } from '@/utils/logger';

export class PendingState implements IDebtState {
  readonly status: DebtStatus = 'pending';

  private readonly validTransitions: DebtStatus[] = ['confirmed', 'disputed', 'cancelled'];

  canTransitionTo(targetStatus: DebtStatus, _debt: Debt, _context: TransitionContext): boolean {
    return this.validTransitions.includes(targetStatus);
  }

  getValidTransitions(): DebtStatus[] {
    return [...this.validTransitions];
  }

  async onEnter(debt: Debt, context: TransitionContext): Promise<void> {
    log.info('DEBT_STATE', `Debt ${debt.id} entered pending state`, {
      debtId: debt.id,
      userId: context.userId,
      previousStatus: context.previousStatus
    });
  }

  async onExit(debt: Debt, context: TransitionContext): Promise<void> {
    log.info('DEBT_STATE', `Debt ${debt.id} exiting pending state`, {
      debtId: debt.id,
      userId: context.userId,
      newStatus: context.newStatus
    });
  }

  validate(debt: Debt, _context: TransitionContext): { valid: boolean; error?: string } {
    if (debt.amount <= 0) {
      return { valid: false, error: 'Debt amount must be positive' };
    }
    return { valid: true };
  }
}
