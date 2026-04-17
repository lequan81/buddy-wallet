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

// Re-export state machine types from their canonical location
// TODO: Import from app/Models after refactoring (April 20)
// export type {
//   TransitionContext,
//   TransitionResult,
//   IDebtState,
//   IDebtStateMachine
// } from '@/app/Models/debtStateMachine';
