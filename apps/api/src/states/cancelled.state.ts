/**
 * Cancelled State (Terminal)
 *
 * Debt has been cancelled. This is a terminal state.
 * Cannot transition to any other state.
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '../types';
import type { IDebtState, TransitionContext } from '../types/debt-state';
import { log } from '../utils/logger';

export class CancelledState implements IDebtState {
  readonly status: DebtStatus = 'cancelled';

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

    // TODO: Send cancellation notice to both parties
    // await notificationService.sendDebtCancelled(debt, context.reason);
  }

  // No onExit - terminal state cannot be exited

  validate(_debt: Debt, _context: TransitionContext): { valid: boolean; error?: string } {
    return { valid: true };
  }
}
