
import type { SafeUser } from './user';

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
  lastSyncAt?: Date | string | null;
}

export interface DebtDetails extends Debt {
  debtor?: SafeUser | null;
  creditor?: SafeUser | null;
  uploader?: SafeUser | null;
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

export type DebtResult = 
  | ({ data: DebtResultData })
  | ({ code: string; error?: string; message?: string });

export interface CreateDebtInput {
  counterpartyPhone: string;
  amount: number;
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

export type StatusUpdateResult = 
  | ({ data: StatusUpdateResultData })
  | ({ code: string; error?: string; message?: string });
