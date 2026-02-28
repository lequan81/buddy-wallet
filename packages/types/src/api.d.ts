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

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  phoneNumber?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
  isLocked?: boolean;
  lockoutUntil?: string | null;
  emailVerified?: boolean;
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Debt {
  id: string;
  description: string;
  amount: number;
  status: string;
  createdAt: string;
  creditorId?: string;
  debtorId?: string;
  creditorPhone?: string;
  debtorPhone?: string;
  uploadedById?: string;
  needsConfirmation?: boolean;
  confirmedByCreditor?: boolean;
  confirmedByDebtor?: boolean;
}
