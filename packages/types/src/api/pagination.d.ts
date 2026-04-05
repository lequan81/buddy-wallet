import type { BaseResult } from './base';
export type { ExpiryOption } from './base';

/**
 * Pagination and API Response Types
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type ApiPaginationOptions = PaginationOptions;



export interface Pagination {
  total: number;
  page: number;
  limit: number;
  offset?: number;
  hasMore?: boolean;
}

export interface PaginatedResult<T> extends BaseResult {
  success: true;
  data: T[];
  pagination: Pagination;
}

export interface DebtCheckResult extends BaseResult {
  summary?: {
    total: number;
  };
}
