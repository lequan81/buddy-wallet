/**
 * Paid State (Terminal)
 *
 * Debt has been fully paid. This is a terminal state.
 * Cannot transition to any other state.
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '../types';
import type { IDebtState, TransitionContext } from '../types/debt-state';
import { log } from '@repo/logger';

export class PaidState implements IDebtState {
  readonly status: DebtStatus = 'paid';

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

    // TODO: Send payment confirmation to both parties
    // await notificationService.sendPaymentConfirmation(debt);
  }

  // No onExit - terminal state cannot be exited

  validate(_debt: Debt, _context: TransitionContext): { valid: boolean; error?: string } {
    return { valid: true };
  }
}
