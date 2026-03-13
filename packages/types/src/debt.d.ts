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
  debt?: QuickDebt;
  debts?: QuickDebt[];
}

export interface StatusUpdateResult {
  success: boolean;
  error?: string;
  code?: string;
  debt?: QuickDebt;
  previousStatus?: string;
  newStatus?: string;
  validTransitions?: string[];
}

export interface QuickDebt {
  id: string;
  description: string;
  amount: number;
  direction: DebtDirection;
  status: string;
  counterpartyPhone: string;
  counterpartyName?: string;
  createdAt: string;
}
