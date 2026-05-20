/** Base pagination query */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  cursor?: string;
}

/** Generic list query with filters and sorting */
export type ListQuery<
  TFilters extends Record<string, unknown> = Record<string, never>,
  TSort extends string = never
> = PaginationQuery & {
  filters?: TFilters;
  sortBy?: TSort;
  sortOrder?: 'asc' | 'desc';
  search?: string;
};
