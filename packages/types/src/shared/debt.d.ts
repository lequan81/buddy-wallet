
import type { UserResponse } from './user';
import type { Result } from '../api/base';

/**
 * Core Debt Types
 */
export type DebtStatus = 'pending' | 'confirmed' | 'paid' | 'disputed' | 'cancelled';

export type DebtDirection = 'LEND' | 'BORROW';

export interface Debt {
  id: string;
  debtorPhone: string;
  creditorPhone: string;
  debtorId: string | null;
  creditorId: string | null;
  uploadedById: string;
  amount: number;
  currency: string;
  description: string | null;
  status: DebtStatus;
  confirmedByCreditor: boolean;
  confirmedByDebtor: boolean;
  needsConfirmation: boolean;
  creditorConfirmedAt: Date | string | null;
  debtorConfirmedAt: Date | string | null;
  hasPendingProof: boolean;
  proofCount: number;
  lastProofUploadedAt: Date | string | null;
  expiresAt: Date | string | null;
  suggestedAmount: number | null;
  suggestedDescription: string | null;
  suggestedById: string | null;
  suggestedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
  dueDate?: Date | string | null;
  lastSyncAt?: Date | string | null;
}

export interface DebtDetails extends Debt {
  debtor?: UserResponse | null;
  creditor?: UserResponse | null;
  uploader?: UserResponse | null;
  creditorName?: string | null;
  debtorName?: string | null;
  customCreditorName?: string | null;
  customDebtorName?: string | null;
  direction?: DebtDirection;
  overdue?: boolean;
}

export interface DebtResultData {
  item?: DebtDetails;
  items?: DebtDetails[];

  // Backward-compatible aliases
  debt?: DebtDetails;
  debts?: DebtDetails[];
  duplicateCount?: number;
  newCount?: number;
  duplicates?: Array<{ id: string; amount: number; description: string | null; createdAt: Date }>;
}

export type DebtResult = Result<DebtResultData>;

export interface CreateDebtInput {
  counterpartyPhone: string;
  amount: number;
  currency: string;
  description?: string;
  counterpartyName?: string;
  dueDate?: Date | string | null;
  status?: DebtStatus;
  direction: DebtDirection;
}

export interface UpdateDebtStatusInput {
  status: DebtStatus;
  notes?: string;
}

export interface UpdateDebtInput extends Partial<CreateDebtInput> {
  id?: string;
}

export interface StatusUpdateResultData {
  item?: DebtDetails;

  // Backward-compatible alias
  debt?: DebtDetails;
  previousStatus?: DebtStatus;
  newStatus?: DebtStatus;
  validTransitions?: DebtStatus[];
}

export type StatusUpdateResult = Result<StatusUpdateResultData>;
