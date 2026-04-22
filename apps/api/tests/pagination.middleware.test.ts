import { describe, expect, test } from 'bun:test';
import { parseOffsetPagination } from '../src/lib/http/pagination';

describe('parseOffsetPagination', () => {
  test('accepts valid values', () => {
    const result = parseOffsetPagination({ limit: '20', offset: '10' });
    expect(result).toEqual({ limit: 20, offset: 10 });
  });

  test('clamps limit and offset to configured maximums', () => {
    const result = parseOffsetPagination({ limit: '9999', offset: '999999999' });
    expect(result.limit).toBeLessThanOrEqual(100);
    expect(result.offset).toBeLessThanOrEqual(999999999);
  });

  test('handles invalid limit with default', () => {
    expect(parseOffsetPagination({ limit: '-1', offset: '0' })).toEqual({ limit: 1, offset: 0 });
    expect(parseOffsetPagination({ limit: 'abc', offset: '0' })).toEqual({ limit: 20, offset: 0 });
  });

  test('handles invalid offset with default', () => {
    expect(parseOffsetPagination({ limit: '10', offset: '-1' })).toEqual({ limit: 10, offset: 0 });
    expect(parseOffsetPagination({ limit: '10', offset: 'abc' })).toEqual({ limit: 10, offset: 0 });
  });
});
