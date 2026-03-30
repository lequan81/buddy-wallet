import type { BaseResult } from './base';

/**
 * Pagination and API Response Types
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> extends BaseResult {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DebtCheckResult extends BaseResult {
  summary?: {
    totalActiveDebts: number;
    count: number;
  };
}
