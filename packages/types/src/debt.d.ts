import type { BaseResult } from './base.js';
import type { Debt, DebtStatus } from '@repo/db';

/**
 * DebtDetails represents the exact JSON payload sent over the wire.
 * It strictly extends the database Debt type but transforms Date fields into ISO strings
 * to match API serialization behavior.
 */
export interface DebtDetails extends Omit<Debt, 'createdAt' | 'updatedAt' | 'creditorConfirmedAt' | 'debtorConfirmedAt' | 'lastProofUploadedAt' | 'expiresAt' | 'suggestedAt' | 'deletedAt'> {
  createdAt: string;
  updatedAt: string;
  creditorConfirmedAt: string | null;
  debtorConfirmedAt: string | null;
  lastProofUploadedAt: string | null;
  expiresAt: string | null;
  suggestedAt: string | null;
  deletedAt: string | null;
}

export type { DebtStatus };
export type DebtDirection = 'LEND' | 'BORROW';

export interface CreateDebtInput {
  amount: number;
  description: string;
  counterpartyPhone: string;
  direction: DebtDirection;
}

export interface DebtResult extends BaseResult {
  debt?: DebtDetails;
  debts?: DebtDetails[];
}

export interface StatusUpdateResult extends BaseResult {
  debt?: DebtDetails;
  previousStatus?: DebtStatus;
  newStatus?: DebtStatus;
  validTransitions?: DebtStatus[];
}

export interface QuickDebt {
  id: string;
  description: string;
  amount: number;
  direction: DebtDirection;
  status: DebtStatus;
  counterpartyPhone: string;
  counterpartyName?: string;
  createdAt: string;
}
