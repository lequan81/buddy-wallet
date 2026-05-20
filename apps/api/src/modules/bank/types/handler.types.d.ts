import type { AuthenticatedHandlerContext } from '@repo/types/api/handler-context';
import type { EntityIdParams } from '@repo/types/api/common-params';
import type { ListQuery } from '@repo/types/api/common-queries';



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

