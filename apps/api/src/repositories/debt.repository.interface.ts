/**
 * Debt Repository Interface (Port)
 * 
 * Defines the contract for debt data access.
 * Business logic depends on this interface, not concrete implementations.
 * This enables swapping implementations (Drizzle, Prisma, mock) without changing business logic.
 */
import type { Debt, NewDebt } from '@repo/db';
import type { DebtStatus, PaginationOptions, PaginatedResult } from '@repo/types';

/**
 * Debt entity for repository operations
 */
export type DebtEntity = Debt;

/**
 * Filter options for debt queries
 */
export interface DebtFilterOptions extends PaginationOptions {
  status?: DebtStatus | 'all';
  debtorId?: string;
  creditorId?: string;
  uploadedById?: string;
  involvedUserId?: string; // User is either debtor or creditor
  includeDeleted?: boolean;
}

/**
 * Data for creating a debt
 */
export type CreateDebtData = NewDebt;

/**
 * Data for updating a debt
 */
export interface UpdateDebtData extends Partial<Omit<DebtEntity, 'id' | 'createdAt'>> {
  updatedAt: Date;
}

/**
 * Debt repository interface (Port in Hexagonal Architecture)
 */
export interface IDebtRepository {
  /**
   * Find debt by ID
   */
  findById(id: string, includeDeleted?: boolean): Promise<DebtEntity | null>;

  /**
   * Find multiple debts by IDs.
   */
  findByIds(ids: string[], includeDeleted?: boolean): Promise<DebtEntity[]>;

  /**
   * Find debts with filters
   */
  findMany(options: DebtFilterOptions): Promise<PaginatedResult<DebtEntity>>;

  /**
   * Count debts matching filters
   */
  count(options: Omit<DebtFilterOptions, 'limit' | 'offset'>): Promise<number>;

  /**
   * Create a new debt
   */
  create(data: CreateDebtData): Promise<DebtEntity>;

  /**
   * Update a debt
   */
  update(id: string, data: UpdateDebtData): Promise<DebtEntity | null>;

  /**
   * Soft delete a debt
   */
  softDelete(id: string, deletedAt: Date): Promise<boolean>;

  /**
   * Find potential duplicates
   */
  findPotentialDuplicates(
    debtorPhone: string,
    creditorPhone: string,
    amount: number,
    amountTolerance: number,
    daysBack: number
  ): Promise<{ id: string; amount: number; description: string | null; createdAt: Date }[]>;

  /**
   * Get recent contacts for a user
   */
  getRecentContacts(userId: string, limit: number): Promise<string[]>;

  /**
   * Count active debts for a phone number
   */
  countActiveDebtsForPhone(phone: string): Promise<number>;

  /**
   * Count unconfirmed debts for a creditor
   */
  countUnconfirmedByCreditor(creditorId: string): Promise<number>;

  /**
   * Batch soft-delete multiple debts by ID
   */
  batchSoftDelete(ids: string[], deletedAt: Date): Promise<{ deleted: string[]; notFound: string[] }>;

  /**
   * Soft-delete all debts uploaded by a user
   */
  softDeleteByUploader(uploadedById: string, deletedAt: Date): Promise<number>;

  /**
   * Link debts to user by phone number (for new user registration)
   */
  linkDebtsToUser(userId: string, phoneNumber: string): Promise<void>;
}
