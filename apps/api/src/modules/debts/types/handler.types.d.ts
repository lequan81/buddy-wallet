import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { EntityIdParams } from '@/types/common-params';
import type { ListQuery } from '@/types/common-queries';

export type DebtStatus = 'pending' | 'confirmed' | 'paid' | 'disputed' | 'cancelled';
export type DebtDirection = 'LEND' | 'BORROW';

/**
 * Debt update data shape for handlers.
 * Handlers should never import @repo/db directly — use this type instead.
 * Repositories are the only consumers of @repo/db.
 */
export interface DebtUpdateData {
  updatedAt: Date;
  status?: DebtStatus;
  amount?: number;
  currency?: string;
  description?: string | null;
  expiresAt?: Date | null;
  confirmedByCreditor?: boolean;
  confirmedByDebtor?: boolean;
  creditorConfirmedAt?: Date | null;
  debtorConfirmedAt?: Date | null;
  suggestedAmount?: number | null;
  suggestedDescription?: string | null;
  suggestedById?: string | null;
  suggestedAt?: Date | null;
  hasPendingProof?: boolean;
  proofCount?: number;
  lastProofUploadedAt?: Date | null;
  deletedAt?: Date | null;
}

export type DebtIdParams = EntityIdParams;

export interface CreateDebtBody {
  debtorId: string;
  amount: number;
  currency: string;
  description?: string;
  dueDate?: string | Date;
  debtorPhone?: string;
  creditorPhone?: string;
}

export interface UpdateDebtBody {
  amount?: number;
  currency?: string;
  description?: string;
  dueDate?: string | Date;
}

export interface CancelDebtBody {
  reason?: string;
}

export interface ConfirmDebtBody {
  proofImageId?: string;
}

export type ListDebtsQuery = Omit<ListQuery, 'sortBy'> & {
  status?: DebtStatus;
  direction?: DebtDirection;
  sortBy?: 'createdAt' | 'amount' | 'status' | 'updatedAt';
};

export interface SuggestEditBody {
  amount?: number;
  description?: string;
}

export interface RespondSuggestionBody {
  accept: boolean;
}

export type CreateDebtContext = AuthenticatedHandlerContext<CreateDebtBody>;
export type GetDebtContext = AuthenticatedHandlerContext<unknown, DebtIdParams>;
export type UpdateDebtContext = AuthenticatedHandlerContext<UpdateDebtBody, DebtIdParams>;
export type RemoveDebtContext = AuthenticatedHandlerContext<unknown, DebtIdParams>;
export type CancelDebtContext = AuthenticatedHandlerContext<CancelDebtBody, DebtIdParams>;
export type ConfirmDebtContext = AuthenticatedHandlerContext<ConfirmDebtBody, DebtIdParams>;
export type CompleteDebtContext = AuthenticatedHandlerContext<unknown, DebtIdParams>;
export type ListDebtsContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ListDebtsQuery>;
export type SuggestEditContext = AuthenticatedHandlerContext<SuggestEditBody, DebtIdParams>;
export type RespondSuggestionContext = AuthenticatedHandlerContext<RespondSuggestionBody, DebtIdParams>;
export type GenerateQRContext = AuthenticatedHandlerContext<unknown, DebtIdParams>;

export type DebtProofParams = { id: string; proofId: string };

export interface RejectProofBody {
  reason?: string;
}

export type ApproveProofContext = AuthenticatedHandlerContext<unknown, DebtProofParams>;
export type RejectProofContext = AuthenticatedHandlerContext<RejectProofBody, DebtProofParams>;
