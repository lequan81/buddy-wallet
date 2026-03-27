/// <reference types="@repo/db" />

export interface VietQRBank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  transferSupported: number;
  lookupSupported: number;
}

export interface VietQRResponse {
  code: string;
  desc: string;
  data: VietQRBank[];
}

export interface BankAccount extends Omit<import('@repo/db').BankAccount, 'createdAt' | 'updatedAt'> {
  createdAt: Date | string | number;
  updatedAt: Date | string | number;
}
