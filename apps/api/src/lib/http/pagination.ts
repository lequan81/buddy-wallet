/**
 * Pagination utilities for offset/limit and page-based pagination
 */

export interface OffsetPaginationQuery {
  offset?: number | string;
  limit?: number | string;
}

export interface PagePaginationQuery {
  page?: number | string;
  limit?: number | string;
}

/**
 * Parse offset-based pagination from query parameters
 * Used for: limit/offset style APIs
 */
export function parseOffsetPagination(
  query: Record<string, any> = {}
): { offset: number; limit: number } {
  const offset = Math.max(0, parseInt(query.offset as string) || 0);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit as string) || 20));

  return { offset, limit };
}

/**
 * Parse page-based pagination from query parameters
 * Used for: page/limit style APIs
 */
export function parsePagePagination(
  query: Record<string, any> = {}
): { page: number; limit: number } {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit as string) || 20));

  return { page, limit };
}
