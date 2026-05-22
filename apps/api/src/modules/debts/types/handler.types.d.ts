import type { AuthenticatedHandlerContext } from '@repo/types/api/handler-context';
import type { EntityIdParams } from '@repo/types/api/common-params';
import type { ListQuery } from '@repo/types/api/common-queries';

import type { Debt, DebtStatus, DebtDirection, CreateDebtInput } from '@repo/types';

export type { DebtStatus, DebtDirection, Debt };
import type { DebtRepository } from '@/repositories/debt/debt.repo';
import type { UserRepository } from '@/repositories/user/user.repo';

/**
 * Debt update data shape for repositories.
 */
export type DebtUpdateData = Partial<Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>> & {
  updatedAt: Date;
};

export type DebtIdParams = EntityIdParams;

import type * as v from 'valibot';
import type { CreateDebtSchema, UpdateDebtSchema } from '../schema';

export type CreateDebtBody = v.InferInput<typeof CreateDebtSchema>;
export type UpdateDebtBody = v.InferInput<typeof UpdateDebtSchema>;

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

export interface DebtDeps {
  debtRepo?: DebtRepository;
  userRepo?: UserRepository;
}

export interface RejectProofBody { reason?: string }

export type CreateDebtContext = AuthenticatedHandlerContext<CreateDebtBody, Record<string, string>, Record<string, unknown>, DebtDeps>;
export type GetDebtContext = AuthenticatedHandlerContext<unknown, DebtIdParams, Record<string, unknown>, DebtDeps>;
export type UpdateDebtContext = AuthenticatedHandlerContext<UpdateDebtBody, DebtIdParams, Record<string, unknown>, DebtDeps>;
export type RemoveDebtContext = AuthenticatedHandlerContext<unknown, DebtIdParams, Record<string, unknown>, DebtDeps>;
export type CancelDebtContext = AuthenticatedHandlerContext<CancelDebtBody, DebtIdParams, Record<string, unknown>, DebtDeps>;
export type ConfirmDebtContext = AuthenticatedHandlerContext<ConfirmDebtBody, DebtIdParams, Record<string, unknown>, DebtDeps>;
export type CompleteDebtContext = AuthenticatedHandlerContext<unknown, DebtIdParams, Record<string, unknown>, DebtDeps>;
export type ListDebtsContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ListDebtsQuery, DebtDeps>;
export type SuggestEditContext = AuthenticatedHandlerContext<SuggestEditBody, DebtIdParams, Record<string, unknown>, DebtDeps>;
export type RespondSuggestionContext = AuthenticatedHandlerContext<RespondSuggestionBody, DebtIdParams, Record<string, unknown>, DebtDeps>;
export type GenerateQRContext = AuthenticatedHandlerContext<unknown, DebtIdParams, Record<string, unknown>, DebtDeps>;

export type DebtProofParams = { id: string; proofId: string };

export type ApproveProofContext = AuthenticatedHandlerContext<unknown, DebtProofParams, Record<string, unknown>, DebtDeps>;
export type RejectProofContext = AuthenticatedHandlerContext<RejectProofBody, DebtProofParams, Record<string, unknown>, DebtDeps>;

export type BatchRemoveDebtContext = AuthenticatedHandlerContext<{ ids: string[] }, never, never, DebtDeps>;
export type RemoveAllDebtContext = AuthenticatedHandlerContext<never, never, { confirm: 'true' }, DebtDeps>;


