import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { EntityIdParams } from '@/types/common-params';
import type { ListQuery } from '@/types/common-queries';

export type { DebtStatus, DebtDirection, Debt } from '@repo/types/core/debt';
import type { Debt } from '@repo/types/core/debt';
import type { CreateDebtInput } from '@repo/types/core/debt';

/**
 * Debt update data shape for repositories.
 */
export type DebtUpdateData = Partial<Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>> & {
  updatedAt: Date;
};

export type DebtIdParams = EntityIdParams;

export interface CreateDebtBody extends Omit<CreateDebtInput, 'direction' | 'counterpartyPhone'> {
  debtorId: string;
  debtorPhone?: string;
  creditorPhone?: string;
}

export type UpdateDebtBody = {
  amount?: number;
  currency?: string;
  description?: string;
  dueDate?: string | Date | null;
};

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
