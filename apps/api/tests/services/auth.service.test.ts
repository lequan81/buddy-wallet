/**
 * Auth Service Unit Tests
 *
 * Demonstrates testing with dependency injection using mocked database.
 * These tests show how the class-based DI pattern enables unit testing
 * without requiring a real database connection.
 */
import { describe, expect, it, beforeEach } from 'bun:test';
import { AuthService } from '@services/auth';

// Simplified mock database for demonstrating DI pattern
function createMockDb() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => undefined // No user found by default
        })
      })
    }),
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: 'new-user-id', email: null, role: 'user' }]
      })
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve()
      })
    })
  };
}

describe('AuthService (Unit Tests with DI)', () => {
  let authService: AuthService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const mockDebtRepo = { linkDebtsToUser: async () => undefined } as unknown as ConstructorParameters<typeof AuthService>[1];
    const mockEmailService = {} as unknown as ConstructorParameters<typeof AuthService>[2];
    const mockVerificationService = {} as unknown as ConstructorParameters<typeof AuthService>[3];
    authService = new AuthService(
      mockDb as unknown as ConstructorParameters<typeof AuthService>[0],
      mockDebtRepo,
      mockEmailService,
      mockVerificationService
    );
  });

  describe('input validation', () => {
    it('should reject invalid phone numbers', async () => {
      const result = await authService.register({
        name: 'Test User',
        phoneNumber: '123', // Too short
        password: 'password123'
      });

      expect('code' in result).toBe(true);
      if ('code' in result) {
        expect(result.code).toBeDefined();
      }
    });

    it('should reject empty phone numbers', async () => {
      const result = await authService.register({
        name: 'Test User',
        phoneNumber: '',
        password: 'password123'
      });

      expect('code' in result).toBe(true);
    });
  });
});
