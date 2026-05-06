/**
 * Debt feature-local helper types.
 * Canonical debt entities/contracts live in @repo/types.
 */

// ── Service Interfaces (from debt.interfaces.d.ts) ───────────────────

/** Push notification payload for debt events */
export interface PushPayload {
  type: string;
  debtId: string;
  message: string;
}

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

