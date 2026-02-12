/**
 * Debt State Machine (OCP Compliance)
 *
 * Manages debt status transitions using the State Pattern.
 * New states can be added by:
 * 1. Creating a new class implementing IDebtState
 * 2. Registering it with stateMachine.registerState(new MyState())
 *
 * No modification to existing code required (Open/Closed Principle)
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '../types';
import type { IDebtState, IDebtStateMachine, TransitionContext, TransitionResult } from '../types/debt-state';
import { log } from '../utils/logger';

// Import all state implementations
import { PendingState } from './pending.state';
import { ConfirmedState } from './confirmed.state';
import { DisputedState } from './disputed.state';
import { PaidState } from './paid.state';
import { CancelledState } from './cancelled.state';

/**
 * Debt State Machine Implementation
 *
 * Usage:
 * ```typescript
 * const machine = new DebtStateMachine();
 * const result = await machine.transition(debt, 'confirmed', context);
 * ```
 */
export class DebtStateMachine implements IDebtStateMachine {
  private states: Map<DebtStatus, IDebtState> = new Map();

  constructor() {
    // Register default states
    this.registerState(new PendingState());
    this.registerState(new ConfirmedState());
    this.registerState(new DisputedState());
    this.registerState(new PaidState());
    this.registerState(new CancelledState());

    log.info('DEBT_STATE', `State machine initialized with ${this.states.size} states`);
  }

  /**
   * Register a new state handler
   * Use this to add custom states without modifying the class
   */
  registerState(state: IDebtState): void {
    this.states.set(state.status, state);
    log.debug('DEBT_STATE', `Registered state: ${state.status}`);
  }

  /**
   * Get the state handler for a given status
   */
  getState(status: DebtStatus): IDebtState | undefined {
    return this.states.get(status);
  }

  /**
   * Get all registered states
   */
  getAllStates(): IDebtState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get valid transitions for a debt's current status
   */
  getValidTransitionsFor(debt: Debt): DebtStatus[] {
    const currentState = this.states.get(debt.status as DebtStatus);
    if (!currentState) {
      return [];
    }
    return currentState.getValidTransitions();
  }

  /**
   * Check if a transition is valid without executing it
   */
  canTransition(debt: Debt, newStatus: DebtStatus, context: TransitionContext): boolean {
    const currentState = this.states.get(debt.status as DebtStatus);
    if (!currentState) {
      return false;
    }
    return currentState.canTransitionTo(newStatus, debt, context);
  }

  /**
   * Execute a state transition
   */
  async transition(
    debt: Debt,
    newStatus: DebtStatus,
    context: TransitionContext
  ): Promise<TransitionResult> {
    const currentState = this.states.get(debt.status as DebtStatus);
    const newState = this.states.get(newStatus);

    // Validate current state exists
    if (!currentState) {
      log.error('DEBT_STATE', `Unknown current state: ${debt.status}`, {
        debtId: debt.id,
        currentStatus: debt.status
      });
      return {
        success: false,
        error: `Unknown current state: ${debt.status}`,
        code: 'UNKNOWN_STATE'
      };
    }

    // Validate target state exists
    if (!newState) {
      log.error('DEBT_STATE', `Unknown target state: ${newStatus}`, {
        debtId: debt.id,
        targetStatus: newStatus
      });
      return {
        success: false,
        error: `Unknown target state: ${newStatus}`,
        code: 'UNKNOWN_STATE'
      };
    }

    // Check if transition is allowed
    if (!currentState.canTransitionTo(newStatus, debt, context)) {
      const validTransitions = currentState.getValidTransitions();
      log.warn('DEBT_STATE', `Invalid transition: ${debt.status} -> ${newStatus}`, {
        debtId: debt.id,
        currentStatus: debt.status,
        targetStatus: newStatus,
        validTransitions
      });
      return {
        success: false,
        error: `Cannot transition from '${debt.status}' to '${newStatus}'`,
        code: 'INVALID_TRANSITION',
        previousStatus: debt.status as DebtStatus,
        validTransitions
      };
    }

    // Validate current state rules
    if (currentState.validate) {
      const validation = currentState.validate(debt, context);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Validation failed',
          code: 'VALIDATION_FAILED',
          previousStatus: debt.status as DebtStatus
        };
      }
    }

    try {
      // Execute onExit hook for current state
      if (currentState.onExit) {
        await currentState.onExit(debt, { ...context, newStatus });
      }

      // Execute onEnter hook for new state
      if (newState.onEnter) {
        await newState.onEnter(debt, { ...context, previousStatus: debt.status as DebtStatus });
      }

      log.info('DEBT_STATE', `Transition successful: ${debt.status} -> ${newStatus}`, {
        debtId: debt.id,
        previousStatus: debt.status,
        newStatus,
        userId: context.userId
      });

      return {
        success: true,
        previousStatus: debt.status as DebtStatus,
        newStatus
      };
    } catch (error) {
      log.error('DEBT_STATE', `Transition failed with error`, {
        debtId: debt.id,
        previousStatus: debt.status,
        newStatus,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transition failed',
        code: 'TRANSITION_ERROR',
        previousStatus: debt.status as DebtStatus
      };
    }
  }
}

// Export singleton instance for convenience
export const debtStateMachine = new DebtStateMachine();
