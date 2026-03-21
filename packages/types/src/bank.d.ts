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

import type { BankAccount as DBBankAccount } from '@repo/db';

export interface BankAccount extends Omit<DBBankAccount, 'createdAt' | 'updatedAt'> {
  createdAt: Date | string | number;
  updatedAt: Date | string | number;
}
