/**
 * DI Container Integration Tests
 *
 * Tests that all services can be resolved from the DI container
 * and that dependencies are properly injected.
 */
import { describe, expect, it, beforeEach } from 'bun:test';
import { container } from 'tsyringe';
import { AppServiceProvider } from '@/app/Providers/AppServiceProvider';
import { resetContainer, setupTestEnvironment } from '../utils/di-helpers';

describe('DI Container', () => {
  beforeEach(() => {
    resetContainer();
  });

  describe('service resolution', () => {
    it('should resolve all core services without errors', () => {
      const provider = new AppServiceProvider();
      provider.register();

      // Core services that should resolve
      const services = [
        'AuthService',
        'UserService',
        'DebtQueryService',
        'DebtCommandService',
        'DebtStatusService',
        'SessionService',
        'PushService',
        'ActivityService',
        'EmailService',
        'NotificationService'
      ];

      for (const serviceName of services) {
        expect(() => {
          container.resolve(serviceName);
        }).not.toThrow();
      }
    });

    it('should resolve all repositories', () => {
      const provider = new AppServiceProvider();
      provider.register();

      const repositories = [
        'UserRepositoryInterface',
        'DebtRepositoryInterface',
        'SessionRepositoryInterface',
        'NotificationRepositoryInterface',
        'ActivityRepositoryInterface',
        'EmailVerificationRepositoryInterface'
      ];

      for (const repoName of repositories) {
        expect(() => {
          container.resolve(repoName);
        }).not.toThrow();
      }
    });
  });

  describe('test container setup', () => {
    it('should create isolated test container', async () => {
      const testContainer = await setupTestEnvironment();

      // Should be able to resolve services from test container
      const userRepo = testContainer.resolve('UserRepositoryInterface') as { findById: unknown };
      expect(userRepo).toBeDefined();
      expect(typeof userRepo.findById).toBe('function');
    });

    it('should use mock database in test environment', async () => {
      const testContainer = await setupTestEnvironment();

      const db = testContainer.resolve('Database') as { query: unknown };
      expect(db).toBeDefined();
      expect(typeof db.query).toBe('object');
    });
  });

  describe('dependency injection', () => {
    it('should inject dependencies into DebtQueryService', async () => {
      const testContainer = await setupTestEnvironment();

      // Import DebtQueryService and try to resolve
      const { DebtQueryService } = await import('@/app/Services/DebtQueryService');
      testContainer.register(DebtQueryService, { useClass: DebtQueryService });

      const debtQueryService = testContainer.resolve(DebtQueryService) as {
        getDebts: (...args: unknown[]) => unknown;
      };
      expect(debtQueryService).toBeDefined();
      expect(typeof debtQueryService.getDebts).toBe('function');
    });
  });
});
