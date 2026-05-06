import { describe, expect, test } from 'bun:test';
import { isRedisAvailable } from '@/providers/redis';

describe('Redis Provider Availability', () => {
  test('returns a boolean availability signal', () => {
    expect(typeof isRedisAvailable()).toBe('boolean');
  });
});
