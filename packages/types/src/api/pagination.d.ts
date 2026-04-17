export type { ExpiryOption } from './base';

/**
 * Pagination and API Response Types
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
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
  nextCursor?: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: Pagination;
}

export interface DebtCheckData {
  summary: {
    total: number;
  };
}

/**
 * Result type for debt checks
 */
export type DebtCheckResult = import('./base').Result<DebtCheckData>;
