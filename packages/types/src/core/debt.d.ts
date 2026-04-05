import type { Debt as DBDebt } from '@repo/db';
import type { DebtStatus, DebtDirection } from '@repo/config';
import type { BaseResult } from '../api/base';
import type { SafeUser } from './user';

/**
 * Core Debt Types
 */
export interface Debt extends Omit<DBDebt, 'createdAt' | 'updatedAt' | 'deletedAt' | 'lastSyncAt' | 'creditorConfirmedAt' | 'debtorConfirmedAt' | 'lastProofUploadedAt' | 'expiresAt' | 'suggestedAt'> {
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
  lastSyncAt: Date | string | null;
  creditorConfirmedAt: Date | string | null;
  debtorConfirmedAt: Date | string | null;
  lastProofUploadedAt: Date | string | null;
  expiresAt: Date | string | null;
  suggestedAt: Date | string | null;
}

export interface DebtDetails extends Debt {
  debtor?: SafeUser | null;
  creditor?: SafeUser | null;
  uploader?: SafeUser | null;
}

export interface DebtResult extends BaseResult {
  debt?: DebtDetails;
  debts?: DebtDetails[];
  duplicateCount?: number;
  newCount?: number;
  duplicates?: Array<{ id: string; amount: number; description: string | null; createdAt: Date }>;
}

export interface CreateDebtInput {
  counterpartyPhone: string;
  amount: number;
  description?: string;
  counterpartyName?: string;
  dueDate?: Date | string | null;
  status?: DebtStatus;
  direction: DebtDirection;
}

export interface StatusUpdateResult extends BaseResult {
  debt?: DebtDetails;
  previousStatus?: DebtStatus;
  newStatus?: DebtStatus;
  validTransitions?: DebtStatus[];
}
