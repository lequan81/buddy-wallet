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
