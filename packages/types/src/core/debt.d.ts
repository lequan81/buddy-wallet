import type { Debt as DBDebt } from '@repo/db';
import type { DebtStatus, DebtDirection } from '@repo/config';
import type { BaseResult } from '../api/base';
import type { SafeUser } from './user';

/**
 * Core Debt Types
 */
export interface Debt extends Omit<DBDebt, 'deletedAt' | 'lastSyncAt'> {
  deletedAt: Date | string | null;
  lastSyncAt: Date | string | null;
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
}

export interface CreateDebtInput {
  debtorPhone: string;
  debtorName: string;
  amount: number;
  description?: string;
  dueDate?: Date | string;
  status?: DebtStatus;
  direction: DebtDirection;
}

export interface StatusUpdateResult extends BaseResult {
  debtId: string;
  oldStatus?: DebtStatus;
  newStatus?: DebtStatus;
}
