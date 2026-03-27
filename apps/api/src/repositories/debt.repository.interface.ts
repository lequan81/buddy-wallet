/**
 * Debt Repository Interface (Port)
 * 
 * Defines the contract for debt data access.
 * Business logic depends on this interface, not concrete implementations.
 * This enables swapping implementations (Drizzle, Prisma, mock) without changing business logic.
 */
import type { Debt, DebtStatus } from '@repo/db';
import type { DebtDetails } from '@repo/types';
import type { PaginationOptions, PaginatedResult } from '../../types';

/**
 * Debt entity for repository operations
 */
export interface DebtEntity {
  id: string;
  debtorPhone: string;
  creditorPhone: string;
  debtorId: string | null;
  creditorId: string | null;
  uploadedById: string;
  amount: number;
  description: string | null;
  status: DebtStatus;
  confirmedByCreditor: boolean;
  confirmedByDebtor: boolean;
  needsConfirmation: boolean;
  creditorConfirmedAt: Date | null;
  debtorConfirmedAt: Date | null;
  hasPendingProof: boolean;
  proofCount: number;
  lastProofUploadedAt: Date | null;
  expiresAt: Date | null;
  suggestedAmount: number | null;
  suggestedDescription: string | null;
  suggestedById: string | null;
  suggestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

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
export interface CreateDebtData {
  id: string;
  amount: number;
  description: string;
  status: string;
  uploadedById: string;
  confirmedByCreditor: boolean;
  confirmedByDebtor: boolean;
  needsConfirmation: boolean;
  creditorConfirmedAt: Date | null;
  debtorConfirmedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  debtorId: string | null;
  creditorId: string | null;
  debtorPhone: string;
  creditorPhone: string;
}

/**
 * Data for updating a debt
 */
export interface UpdateDebtData {
  amount?: number;
  description?: string;
  status?: DebtStatus;
  confirmedByCreditor?: boolean;
  confirmedByDebtor?: boolean;
  needsConfirmation?: boolean;
  creditorConfirmedAt?: Date | null;
  debtorConfirmedAt?: Date | null;
  expiresAt?: Date | null;
  suggestedAmount?: number | null;
  suggestedDescription?: string | null;
  suggestedById?: string | null;
  suggestedAt?: Date | null;
  deletedAt?: Date | null;
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
   * Link debts to user by phone number (for new user registration)
   */
  linkDebtsToUser(userId: string, phoneNumber: string): Promise<void>;
}
