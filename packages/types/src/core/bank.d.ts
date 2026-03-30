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
