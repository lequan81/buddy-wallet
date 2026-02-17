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
  message?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debt?: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debts?: any[];
}

export interface StatusUpdateResult {
  success: boolean;
  error?: string;
  code?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debt?: any;
  previousStatus?: string;
  newStatus?: string;
  validTransitions?: string[];
}
