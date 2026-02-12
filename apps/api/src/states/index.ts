/**
 * Debt States Module
 *
 * Exports all debt state implementations and the state machine.
 *
 * Usage:
 * ```typescript
 * import { debtStateMachine } from '../states';
 *
 * // Transition a debt
 * const result = await debtStateMachine.transition(debt, 'confirmed', context);
 *
 * // Add a custom state
 * debtStateMachine.registerState(new MyCustomState());
 * ```
 */

// Export state machine
export { DebtStateMachine, debtStateMachine } from './state-machine';

// Export individual states (for extension/testing)
export { PendingState } from './pending.state';
export { ConfirmedState } from './confirmed.state';
export { DisputedState } from './disputed.state';
export { PaidState } from './paid.state';
export { CancelledState } from './cancelled.state';

// Re-export types from dedicated location
export type {
  IDebtState,
  IDebtStateMachine,
  TransitionContext,
  TransitionResult
} from '../types/debt-state';
