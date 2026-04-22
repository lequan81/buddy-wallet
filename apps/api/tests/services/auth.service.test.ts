/**
 * Auth Service Unit Tests
 *
 * Demonstrates testing with dependency injection container.
 * Uses the DI container for proper service resolution and test doubles.
 */
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { AuthService } from '@/app/Services/AuthService';
import {
  createTestContainer,
  mockRepositories,
  resetContainer,
  isErrorResult
} from '../utils/di-helpers';

describe('AuthService (Unit Tests with DI Container)', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Reset container before each test
    resetContainer();

    // Create test container with mock dependencies
    const testContainer = createTestContainer();
    testContainer.register('UserRepositoryInterface', {
      useValue: mockRepositories.userRepository()
    });
    testContainer.register('DebtRepositoryInterface', {
      useValue: mockRepositories.debtRepository()
    });

    // Resolve service from container
    authService = testContainer.resolve(AuthService);
  });

  afterEach(() => {
    resetContainer();
  });

  describe('input validation', () => {
    it('should reject invalid phone numbers', async () => {
      const result = await authService.register({
        name: 'Test User',
        phoneNumber: '123', // Too short
        password: 'password123'
      });

      expect(isErrorResult(result)).toBe(true);
      if (isErrorResult(result)) {
        expect(result.code).toBeDefined();
      }
    });

    it('should reject empty phone numbers', async () => {
      const result = await authService.register({
        name: 'Test User',
        phoneNumber: '',
        password: 'password123'
      });

      expect(isErrorResult(result)).toBe(true);
    });
  });
});
