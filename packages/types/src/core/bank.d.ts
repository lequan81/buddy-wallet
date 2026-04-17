/**
 * Core Bank Types
 */
export interface BankBranch {
  name: string;
  code?: string;
  address?: string;
}

export interface BankInfo {
  id: string;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  transferSupported: number;
  lookupSupported: number;
  support: number;
  isTransfer: number;
  swift_code?: string;
}

export interface VietQRBank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  transferSupported?: number;
  lookupSupported?: number;
  swift_code?: string;
}

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
