/**
 * DI Container Test Utilities
 *
 * Helper functions for testing with the dependency injection container.
 * Provides clean setup/teardown and mock registration patterns.
 */
import { container, DependencyContainer } from 'tsyringe';
import { db } from '@repo/db';
import { logger } from '@repo/logger';

/**
 * Create a test container with isolated registrations
 */
export function createTestContainer(): DependencyContainer {
  return container.createChildContainer();
}

/**
 * Register mock database for testing
 */
export function registerMockDatabase(
  testContainer: DependencyContainer,
  mockDb: typeof db | object = createMockDb()
): void {
  testContainer.register('Database', { useValue: mockDb });
}

/**
 * Create a mock database that mimics Drizzle interface
 */
export function createMockDb(): object {
  const tables: Record<string, unknown[]> = {
    users: [],
    debts: [],
    sessions: [],
    pushSubscriptions: [],
    activityLogs: []
  };

  return {
    query: {
      users: {
        findFirst: async ({ where }: { where: (fields: unknown) => boolean }) => {
          return tables.users.find(u => where(u as Record<string, unknown>)) || null;
        },
        findMany: async () => tables.users
      },
      debts: {
        findFirst: async () => null,
        findMany: async () => tables.debts
      }
    },
    select: () => ({
      from: (table: string) => ({
        where: (_condition: unknown) => {
          const tableData = tables[table] || [];
          return {
            get: async () => tableData[0] || undefined,
            all: async () => tableData
          };
        }
      })
    }),
    insert: (_table: string) => ({
      values: (_data: Record<string, unknown>) => ({
        returning: async () => {
          const id = crypto.randomUUID();
          const record = { ..._data, id };
          tables[_table] = tables[_table] || [];
          tables[_table].push(record);
          return [record];
        }
      })
    }),
    update: (_table: string) => ({
      set: (_data: Record<string, unknown>) => ({
        where: async () => {
          return { updated: 1 };
        }
      })
    }),
    delete: (_table: string) => ({
      where: async () => {
        return { deleted: 1 };
      }
    }),
    // Table references for queries
    users: { id: 'id', email: 'email', phoneNumber: 'phoneNumber' },
    debts: { id: 'id', amount: 'amount', status: 'status' }
  };
}

/**
 * Mock repository factory - creates a mock implementing a repository interface
 */
export function createMockRepository<T extends object>(
  methods: Record<string, (...args: unknown[]) => unknown>
): T {
  return methods as unknown as T;
}

/**
 * Common mock repositories for testing
 */
export const mockRepositories = {
  userRepository: () => ({
    findById: async () => null,
    findByEmail: async () => null,
    findByPhone: async () => null,
    create: async (data: Record<string, unknown>) => ({
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date()
    }),
    update: async () => ({ updated: 1 }),
    delete: async () => ({ deleted: 1 })
  }),

  debtRepository: () => ({
    findById: async () => null,
    findMany: async () => ({ items: [], pagination: { page: 1, limit: 20, total: 0 } }),
    create: async (data: Record<string, unknown>) => ({
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date()
    }),
    update: async () => null,
    softDelete: async () => true,
    countActiveDebtsForPhone: async () => 0,
    countUnconfirmedByCreditor: async () => 0
  }),

  sessionRepository: () => ({
    findById: async () => null,
    findByToken: async () => null,
    create: async () => ({ id: crypto.randomUUID() }),
    invalidate: async () => ({ updated: 1 }),
    cleanupExpired: async () => 0
  }),

  notificationRepository: () => ({
    upsertSubscription: async () => crypto.randomUUID(),
    deleteSubscription: async () => undefined,
    getSubscriptionsByUserId: async () => [],
    getAllActiveSubscriptions: async () => [],
    cleanupInactive: async () => 0
  })
};

/**
 * Reset the global container (use between test suites)
 */
export function resetContainer(): void {
  container.clearInstances();
  container.reset();
}

/**
 * Setup test environment with all services registered
 */
export async function setupTestEnvironment(): Promise<DependencyContainer> {
  const testContainer = createTestContainer();

  // Register core dependencies
  testContainer.register('Database', { useValue: createMockDb() });
  testContainer.register('Logger', { useValue: logger });

  // Register mock repositories
  testContainer.register('UserRepositoryInterface', {
    useValue: mockRepositories.userRepository()
  });
  testContainer.register('DebtRepositoryInterface', {
    useValue: mockRepositories.debtRepository()
  });
  testContainer.register('SessionRepositoryInterface', {
    useValue: mockRepositories.sessionRepository()
  });
  testContainer.register('NotificationRepositoryInterface', {
    useValue: mockRepositories.notificationRepository()
  });

  return testContainer;
}

/**
 * Type guard for Result types
 */
export function isSuccessResult<T>(result: { data?: T; code?: string }): result is { data: T } {
  return 'data' in result && !('code' in result);
}

export function isErrorResult(result: { data?: unknown; code?: string }): result is { code: string; error?: string } {
  return 'code' in result;
}
