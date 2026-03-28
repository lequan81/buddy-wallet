import { configs } from '@/configs';

type PaginationQuery = {
  limit?: string | number | null;
  offset?: string | number | null;
  page?: string | number | null;
};

const toInt = (value: string | number | null | undefined, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

/**
 * Parse and clamp list pagination from query parameters.
 */
export function parseOffsetPagination(query: PaginationQuery): { limit: number; offset: number } {
  const limitRaw = toInt(query.limit, configs.PAGINATION.DEFAULT_LIMIT);
  const offsetRaw = toInt(query.offset, 0);

  return {
    limit: Math.min(Math.max(limitRaw, 1), configs.PAGINATION.MAX_LIMIT),
    offset: Math.max(offsetRaw, 0)
  };
}

/**
 * Parse page+limit style pagination for list endpoints.
 */
export function parsePagePagination(query: PaginationQuery): { page: number; limit: number } {
  const pageRaw = toInt(query.page, 1);
  const limitRaw = toInt(query.limit, configs.PAGINATION.DEFAULT_LIMIT);

  return {
    page: Math.max(pageRaw, 1),
    limit: Math.min(Math.max(limitRaw, 1), configs.PAGINATION.MAX_LIMIT)
  };
}

