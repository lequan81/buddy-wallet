/**
 * Core Bank Types
 *
 * Uses a generic Bank<TIdType> pattern with pre-configured variants.
 */

export interface BankBranch {
  name: string;
  code?: string;
  address?: string;
}

/** Base bank fields shared across all bank types */
export interface BankBase {
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  swift_code?: string;
  transferSupported?: number;
  lookupSupported?: number;
}

/** Generic bank with configurable ID type and optional fields */
export type Bank<
  TIdType extends string | number = string,
  TOptional extends keyof BankBase = never
> = {
  id: TIdType;
} & Required<Pick<BankBase, Exclude<keyof BankBase, TOptional>>>
  & Partial<Pick<BankBase, TOptional>>;

/** BankInfo — all required, string ID */
export type BankInfo = Bank<string> & {
  support: number;
  isTransfer: number;
};

/** VietQRBank — numeric ID, optional transfer fields */
export type VietQRBank = Bank<number, 'transferSupported' | 'lookupSupported'>;

export interface BankAccount {
  id: string;
  userId: string;
  bankCode: string;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string | null;
  isDefault: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}
