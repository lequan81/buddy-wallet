import { describe, expect, test } from 'bun:test';
import { calculatePagination } from '@/commons/http/pagination';

describe('Pagination Helper', () => {
  test('calculates metadata for first page', () => {
    const meta = calculatePagination(95, 1, 20);
    expect(meta.total).toBe(95);
    expect(meta.page).toBe(1);
    expect(meta.limit).toBe(20);
    expect(meta.hasMore).toBe(true);
  });

  test('calculates metadata for last page', () => {
    const meta = calculatePagination(95, 5, 20);
    expect(meta.page).toBe(5);
    expect(meta.hasMore).toBe(false);
  });
});
