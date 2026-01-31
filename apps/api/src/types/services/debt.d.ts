/**
 * Debt Type Definitions
 */
export type DebtStatus = 'pending' | 'confirmed' | 'paid' | 'disputed' | 'cancelled';
export type DebtDirection = 'LEND' | 'BORROW';

export interface CreateDebtInput {
  amount: number;
  description: string;
  counterpartyPhone: string;
  direction: DebtDirection;
}

export interface DebtResult {
  success: boolean;
  error?: string;
  code?: string;
  debt?: any;
  debts?: any[];
}

export interface StatusUpdateResult {
  success: boolean;
  error?: string;
  code?: string;
  previousStatus?: string;
  newStatus?: string;
  validTransitions?: string[];
}
