/**
 * Pagination Query Parameters
 *
 * Flexible input that supports both offset/limit and page/limit styles.
 * Values are coerced to numbers (strings accepted from query params).
 */
export type PaginationQuery = {
  limit?: string | number | null;
  offset?: string | number | null;
  page?: string | number | null;
};

