import { describe, expect, test } from 'bun:test';
import { validatePaginationParams } from '../src/plugins/middleware/pagination.middleware';

describe('validatePaginationParams', () => {
  test('accepts valid values', () => {
    const result = validatePaginationParams('20', '10');
    expect(result).toEqual({ limit: 20, offset: 10 });
  });

  test('clamps limit and offset to configured maximums', () => {
    const result = validatePaginationParams('9999', '999999999');
    expect(result.limit).toBeLessThanOrEqual(100);
    expect(result.offset).toBeLessThanOrEqual(50000);
  });

  test('throws for invalid limit', () => {
    expect(() => validatePaginationParams('-1', '0')).toThrow();
    expect(() => validatePaginationParams('abc', '0')).toThrow();
  });

  test('throws for invalid offset', () => {
    expect(() => validatePaginationParams('10', '-1')).toThrow();
    expect(() => validatePaginationParams('10', 'abc')).toThrow();
  });
});
