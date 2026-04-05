import type { Context } from 'elysia';
import { configs } from '@/configs';

const PAGINATION_CONSTRAINTS = {
  DEFAULT_LIMIT: configs.PAGINATION.DEFAULT_LIMIT,
  MAX_LIMIT: configs.PAGINATION.MAX_LIMIT,
  MAX_OFFSET: configs.PAGINATION.MAX_OFFSET ?? 50000,
  MIN_LIMIT: 1
} as const;

export interface PaginationParams {
  limit: number;
  offset: number;
}

export const validatePaginationParams = (
  limit?: string | number,
  offset?: string | number
): PaginationParams => {
  let parsedLimit = PAGINATION_CONSTRAINTS.DEFAULT_LIMIT;
  if (limit !== undefined) {
    const num = Number(limit);
    if (!Number.isInteger(num) || num < PAGINATION_CONSTRAINTS.MIN_LIMIT) {
      throw new Error(
        `Invalid limit: must be integer >= ${PAGINATION_CONSTRAINTS.MIN_LIMIT}`
      );
    }
    parsedLimit = Math.min(num, PAGINATION_CONSTRAINTS.MAX_LIMIT);
  }

  let parsedOffset = 0;
  if (offset !== undefined) {
    const num = Number(offset);
    if (!Number.isInteger(num) || num < 0) {
      throw new Error('Invalid offset: must be non-negative integer');
    }
    parsedOffset = Math.min(num, PAGINATION_CONSTRAINTS.MAX_OFFSET);
  }

  return { limit: parsedLimit, offset: parsedOffset };
};

export const paginationMiddleware = () => {
  return (ctx: Context) => {
    const query = (ctx.query ?? {}) as { limit?: string | number; offset?: string | number };

    try {
      const validated = validatePaginationParams(query.limit, query.offset);
      (ctx.store as Record<string, unknown>).pagination = validated;
    } catch (error) {
      ctx.set.status = 400;
      return {
        success: false,
        error: (error as Error).message
      };
    }
  };
};
