import type { PaginatedResult } from '@repo/types';
import { count, type DbClient } from '@repo/db';

/**
 * PaginationPlugin - Standardized repository pagination helper.
 */
export const PaginationPlugin = {
  /**
   * Universal pagination helper for repos
   */
  async paginate<T>(
    db: DbClient,
    table: any,
    limit: number,
    offset: number,
    where?: any
  ): Promise<{ data: T[]; total: number }> {
    const query = db.select().from(table).limit(limit).offset(offset);
    const countQuery = db.select({ count: count() }).from(table);

    if (where) {
      query.where(where);
      countQuery.where(where);
    }

    const [data, countRes] = await Promise.all([
      query.all(),
      countQuery.get()
    ]);

    return {
      data: data as T[],
      total: countRes?.count ?? 0
    };
  },

  /**
   * Builds a standardized paginated result from items and total count.
   */
  toPaginatedResult<T>(
    items: T[],
    total: number,
    limit: number,
    offset: number
  ): PaginatedResult<T> {
    return {
      items,
      pagination: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit
      }
    };
  }
};

/**
 * Shorthand export
 */
export const paginate = PaginationPlugin.paginate;
