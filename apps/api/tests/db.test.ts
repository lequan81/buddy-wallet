import { describe, test, expect } from 'bun:test';
import { db, users } from '@repo/db';

describe('Database Integration', () => {
  test('should have a valid db instance', () => {
    expect(db).toBeDefined();
  });
});
