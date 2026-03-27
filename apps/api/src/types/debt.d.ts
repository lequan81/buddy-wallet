/**
 * Debt Types - Consolidated
 * 
 * All debt-related interfaces and types in one file:
 * - State machine interfaces (from debt-state.d.ts)
 * - Service interfaces (from debt.interfaces.d.ts)
 * - Shared types for debt services
 */
import type { Debt } from '@repo/db';
import type { DebtStatus } from './services/debt';

// ── Service Interfaces (from debt.interfaces.d.ts) ───────────────────

// PushPayload is defined in push.d.ts — import from there
export type { PushPayload } from './push.d';

/** Debt creation options */
export interface DebtCreationOptions {
  expiryOption?: 'never' | '7d' | '30d' | '90d';
  confirmDuplicate?: boolean;
}

/** Debt suggestion data */
export interface DebtSuggestion {
  amount?: number;
  description?: string;
}

/** Batch delete result */
export interface BatchDeleteResult {
  success: boolean;
  deleted: number;
  errors: string[];
}

// ── State Machine Interfaces (from debt-state.d.ts) ──────────────────

/**
 * Context passed to state lifecycle hooks
 */
export interface TransitionContext {
  /** User initiating the transition */
  userId: string;
  /** User's permissions */
  permissions: string[];
  /** Previous status (for onEnter) */
  previousStatus?: DebtStatus;
  /** New status (for onExit) */
  newStatus?: DebtStatus;
  /** Optional reason for the transition */
  reason?: string;
  /** Timestamp of the transition */
  timestamp: Date;
}

/**
 * Result of a state transition
 */
export interface TransitionResult {
  success: boolean;
  error?: string;
  code?: string;
  previousStatus?: DebtStatus;
  newStatus?: DebtStatus;
  validTransitions?: DebtStatus[];
}

/**
 * Interface for debt state implementations
 * Each status (pending, confirmed, etc.) implements this interface
 */
export interface IDebtState {
  /**
   * The status this state represents
   */
  readonly status: DebtStatus;

  /**
   * Check if transition to the target status is allowed
   * @param targetStatus - The status to transition to
   * @param debt - The debt being transitioned
   * @param context - Transition context with user info
   */
  canTransitionTo(targetStatus: DebtStatus, debt: Debt, context: TransitionContext): boolean;

  /**
   * Get list of valid statuses this state can transition to
   */
  getValidTransitions(): DebtStatus[];

  /**
   * Hook called when entering this state
   * Use for side effects like notifications, logging, etc.
   * @param debt - The debt entering this state
   * @param context - Transition context
   */
  onEnter?(debt: Debt, context: TransitionContext): Promise<void>;

  /**
   * Hook called when exiting this state
   * Use for cleanup or logging
   * @param debt - The debt exiting this state
   * @param context - Transition context
   */
  onExit?(debt: Debt, context: TransitionContext): Promise<void>;

  /**
   * Validate business rules specific to this state
   * @param debt - The debt in this state
   * @param context - Current context
   */
  validate?(debt: Debt, context: TransitionContext): { valid: boolean; error?: string };
}

/**
 * Interface for the debt state machine
 * Manages state registration and transitions
 */
export interface IDebtStateMachine {
  /**
   * Register a new state handler
   * @param state - The state implementation to register
   */
  registerState(state: IDebtState): void;

  /**
   * Get the state handler for a given status
   * @param status - The debt status
   */
  getState(status: DebtStatus): IDebtState | undefined;

  /**
   * Get all registered states
   */
  getAllStates(): IDebtState[];

  /**
   * Attempt to transition a debt to a new status
   * @param debt - The debt to transition
   * @param newStatus - The target status
   * @param context - Transition context
   */
  transition(debt: Debt, newStatus: DebtStatus, context: TransitionContext): Promise<TransitionResult>;

  /**
   * Get valid transitions for a debt's current status
   * @param debt - The debt to check
   */
  getValidTransitionsFor(debt: Debt): DebtStatus[];

  /**
   * Check if a transition is valid without executing it
   * @param debt - The debt to check
   * @param newStatus - The target status
   * @param context - Transition context
   */
  canTransition(debt: Debt, newStatus: DebtStatus, context: TransitionContext): boolean;
}
