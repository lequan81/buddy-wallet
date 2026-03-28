import type { BaseResult, PaginationOptions as BasePaginationOptions } from './base.js';
import type { DebtStatus } from './debt.js';

export interface BankResponse extends BaseResult {
  banks: import('./bank').VietQRBank[];
}

export interface AccountsResponse extends BaseResult {
  accounts: import('./bank').BankAccount[];
}

/** Helper type for API error handling across the web app. */
export interface ApiErrorValue {
  message?: string;
  details?: string;
  error?: string | { message?: string };
  code?: string;
}

/** Base pagination coordinates. */
export interface Pagination {
  limit: number;
  offset: number;
}

/** Standard pagination metadata shape returned by paginated API endpoints. */
export interface PaginationMeta extends Pagination {
  total: number;
  hasMore: boolean;
}

/** Cursor pagination request shape. */
export interface CursorPagination {
  limit: number;
  cursor?: string | null;
}

/** Cursor pagination metadata shape returned by cursor-based endpoints. */
export interface CursorPaginationMeta {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

/** Standard cursor-paginated list result shape. */
export interface CursorPaginatedResult<T> extends CursorPaginationMeta {
  data: T[];
}

export type ExpiryOption = '7d' | '30d' | '90d' | 'never';

/** Standard pagination options for queries. */
export interface ApiPaginationOptions extends BasePaginationOptions {
  status?: DebtStatus | 'all';
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
  status: DebtStatus;
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
