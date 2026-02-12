import type { VietQRBank, BankAccount } from './bank';

export interface BankResponse {
  success: boolean;
  banks: VietQRBank[];
}

export interface AccountsResponse {
  success: boolean;
  accounts: BankAccount[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
