/**
 * Pagination Utilities
 *
 * Shared pagination helpers for all modules.
 * @logicType http
 */

import type { Pagination } from '@repo/types';

/**
 * Calculate pagination metadata from total, page, and limit
 */
export function calculatePagination(total: number, page: number, limit: number): Pagination {
  return {
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}
