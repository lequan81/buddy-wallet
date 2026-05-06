import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { EntityIdParams } from '@/types/common-params';
import type { ListQuery } from '@/types/common-queries';

export type BankAccountIdParams = EntityIdParams;

export interface CreateBankAccountBody {
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string;
  bankBin?: string;
  isDefault?: boolean;
}

export interface UpdateBankAccountBody {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  bankBin?: string;
  isDefault?: boolean;
}

export type ListBankAccountsQuery = ListQuery;

export type CreateBankAccountContext = AuthenticatedHandlerContext<CreateBankAccountBody>;
export type GetBankAccountContext = AuthenticatedHandlerContext<unknown, BankAccountIdParams>;
export type ListBankAccountsContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ListBankAccountsQuery>;
export type UpdateBankAccountContext = AuthenticatedHandlerContext<UpdateBankAccountBody, BankAccountIdParams>;
export type RemoveBankAccountContext = AuthenticatedHandlerContext<unknown, BankAccountIdParams>;
export type SetDefaultBankAccountContext = AuthenticatedHandlerContext<unknown, BankAccountIdParams>;
