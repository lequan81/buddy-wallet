import type { Context } from 'elysia';
import { configs } from '@/config';
import { GEN_ERRORS } from '@repo/errors';
import { apiError } from '@/lib/http';

const Pagination_CONSTRAINTS = {
  DEFAULT_LIMIT: configs.Pagination.DEFAULT_LIMIT,
  MAX_LIMIT: configs.Pagination.MAX_LIMIT,
  MAX_OFFSET: configs.Pagination.MAX_OFFSET ?? 50000,
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
  let parsedLimit = Pagination_CONSTRAINTS.DEFAULT_LIMIT;
  if (limit !== undefined) {
    const num = Number(limit);
    if (!Number.isInteger(num) || num < Pagination_CONSTRAINTS.MIN_LIMIT) {
      throw new Error(
        `Invalid limit: must be integer >= ${Pagination_CONSTRAINTS.MIN_LIMIT}`
      );
    }
    parsedLimit = Math.min(num, Pagination_CONSTRAINTS.MAX_LIMIT);
  }

  let parsedOffset = 0;
  if (offset !== undefined) {
    const num = Number(offset);
    if (!Number.isInteger(num) || num < 0) {
      throw new Error('Invalid offset: must be non-negative integer');
    }
    parsedOffset = Math.min(num, Pagination_CONSTRAINTS.MAX_OFFSET);
  }

  return { limit: parsedLimit, offset: parsedOffset };
};

export const PaginationMiddleware = () => {
  return (ctx: Context) => {
    const query = (ctx.query ?? {}) as { limit?: string | number; offset?: string | number };

    try {
      const validated = validatePaginationParams(query.limit, query.offset);
      (ctx.store as Record<string, unknown>).Pagination = validated;
    } catch (error) {
      ctx.set.status = 400;
      return apiError(GEN_ERRORS.INVALID_INPUT, (error as Error).message);
    }
  };
};
