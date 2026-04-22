import * as v from 'valibot';

/**
 * Common Pagination Schema
 */
export const paginationSchema = v.strictObject({
  page: v.pipe(v.optional(v.number(), 1), v.minValue(1)),
  limit: v.pipe(v.optional(v.number(), 20), v.minValue(1), v.maxValue(100)),
  offset: v.optional(v.pipe(v.number(), v.minValue(0)))
});

export type PaginationInput = v.InferInput<typeof paginationSchema>;
