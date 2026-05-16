import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { EntityIdParams } from '@/types/common-params';
import type { ListQuery } from '@/types/common-queries';



export type BankAccountIdParams = EntityIdParams;

export type CreateBankAccountBody = {
  bankName: string;
  bankCode: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  isDefault?: boolean;
};

export type UpdateBankAccountBody = Partial<CreateBankAccountBody>;

export type ListBankAccountsQuery = ListQuery;

export type CreateBankAccountContext = AuthenticatedHandlerContext<CreateBankAccountBody>;
export type GetBankAccountContext = AuthenticatedHandlerContext<unknown, BankAccountIdParams>;
export type ListBankAccountsContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ListBankAccountsQuery>;
export type UpdateBankAccountContext = AuthenticatedHandlerContext<UpdateBankAccountBody, BankAccountIdParams>;
export type RemoveBankAccountContext = AuthenticatedHandlerContext<unknown, BankAccountIdParams>;
export type SetDefaultBankAccountContext = AuthenticatedHandlerContext<unknown, BankAccountIdParams>;
