/**
 * State Machine Type Definitions
 *
 * Interfaces for the debt state machine pattern.
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from '@repo/types';

export interface TransitionContext {
  userId: string;
  permissions: string[];
  previousStatus?: DebtStatus;
  newStatus?: DebtStatus;
  reason?: string;
  timestamp: Date;
}

export interface TransitionResult {
  success: boolean;
  error?: string;
  code?: string;
  previousStatus?: DebtStatus;
  newStatus?: DebtStatus;
  validTransitions?: DebtStatus[];
}

export interface IDebtState {
  readonly status: DebtStatus;
  canTransitionTo(targetStatus: DebtStatus, debt: Debt, context: TransitionContext): boolean;
  getValidTransitions(): DebtStatus[];
  onEnter?(debt: Debt, context: TransitionContext): Promise<void>;
  onExit?(debt: Debt, context: TransitionContext): Promise<void>;
  validate?(debt: Debt, context: TransitionContext): { valid: boolean; error?: string };
}

export interface IDebtStateMachine {
  registerState(state: IDebtState): void;
  getState(status: DebtStatus): IDebtState | undefined;
  getAllStates(): IDebtState[];
  transition(debt: Debt, newStatus: DebtStatus, context: TransitionContext): Promise<TransitionResult>;
  getValidTransitionsFor(debt: Debt): DebtStatus[];
  canTransition(debt: Debt, newStatus: DebtStatus, context: TransitionContext): boolean;
}
