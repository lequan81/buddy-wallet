/**
 * Shared helper types for API error handling across the web app.
 * Used to replace `as any` casts when accessing Eden Treaty error values.
 */
export interface ApiErrorValue {
  message?: string;
  details?: string;
  error?: string | { message?: string };
  code?: string;
}

/** Standard pagination metadata shape returned by paginated API endpoints. */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
