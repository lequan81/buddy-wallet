/**
 * Auth Service Unit Tests
 *
 * Demonstrates testing with dependency injection using mocked database.
 * These tests show how the class-based DI pattern enables unit testing
 * without requiring a real database connection.
 */
import { describe, expect, it, beforeEach } from 'bun:test';
import { AuthService } from '@/services/auth.service';

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
    authService = new AuthService(mockDb as any);
  });

  describe('input validation', () => {
    it('should reject invalid phone numbers', async () => {
      const result = await authService.register({
        name: 'Test User',
        phoneNumber: '123', // Too short
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number format');
    });

    it('should reject empty phone numbers', async () => {
      const result = await authService.register({
        name: 'Test User',
        phoneNumber: '',
        password: 'password123'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('logout', () => {
    it('should reject empty refresh token', async () => {
      const result = await authService.logout('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No refresh token provided');
    });

    it('should successfully logout with valid token', async () => {
      const result = await authService.logout('valid-refresh-token');

      expect(result.success).toBe(true);
    });
  });

  describe('changePassword', () => {
    it('should reject when user not found', async () => {
      const result = await authService.changePassword(
        'nonexistent-user',
        'oldpassword',
        'newpassword'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });
});
