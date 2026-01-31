import { describe, test, expect } from 'bun:test';
import { db } from '../src/db';
import { users } from '../src/schema';

describe('Database Package', () => {
  test('should initialize database connection', () => {
    expect(db).toBeDefined();
  });

  test('should be able to select from users table', async () => {
    // This assumes the DB is migrated. If not, this might fail, but it's a good test.
    const result = await db.select().from(users).limit(1);
    expect(Array.isArray(result)).toBe(true);
  });

  // Add more specific schema tests or CRUD tests here if appropriate
  // For now, these basic integration tests verify the package setup.
});
