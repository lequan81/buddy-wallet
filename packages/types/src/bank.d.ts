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

export interface BankAccount {
  id: string;
  userId: string;
  bankCode: string;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  createdAt: Date | string | number;
  updatedAt: Date | string | number;
}
