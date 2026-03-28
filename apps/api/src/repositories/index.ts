/**
 * Repositories - Index
 * 
 * Hexagonal Architecture exports:
 * - Ports (Interfaces): Define contracts
 * - Adapters (Implementations): Concrete implementations
 */

// Debt Repository
export type {
  IDebtRepository,
  DebtEntity,
  DebtFilterOptions,
  CreateDebtData,
  UpdateDebtData
} from './debt.repository.interface';

// Adapters
export { DrizzleDebtRepository } from './adapters/drizzle-debt.repository';
export { DrizzleUserRepository, DrizzleSessionRepository } from './adapters/drizzle-user.repository';
export { DrizzleActivityRepository } from './adapters/drizzle-activity.repository';
export { DrizzleBankAccountRepository } from './adapters/drizzle-bank-account.repository';
export { DrizzleNotificationRepository } from './adapters/drizzle-notification.repository';
