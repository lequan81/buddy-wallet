import { describe, test, expect } from 'bun:test';
import { redis } from 'bun';

describe('Redis Integration', () => {
  test('should store and retrieve values', async () => {
    const key = 'test:bun:hello';
    const value = 'Bun is fast';

    await redis.set(key, value);
    const result = await redis.get(key);

    expect(result).toBe(value);

    // Cleanup
    await redis.del(key);
  });

  test('should respond to PING', async () => {
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
  });
});
