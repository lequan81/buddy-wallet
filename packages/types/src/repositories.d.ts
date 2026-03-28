import type { User, Session, ActivityLog, BankAccount, PushSubscription, ImportLog, FileMetadata, FileStatus, EmailVerification, Debt, DebtStatus } from '@repo/db';
import type { PaginatedResult } from './base';
import type { ActivityFilters } from './services';

export interface IUserRepository {
  countAll(): Promise<number>;
  findPaginated(limit: number, offset: number): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  findByPhone(phone: string, excludeId?: string): Promise<User | null>;
  findByEmail(email: string, excludeId?: string): Promise<User | null>;
  update(id: string, data: Partial<User>): Promise<User | null>;
  updateStatus(id: string, isActive: boolean): Promise<User | null>;
  create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  // Auth methods
  findByPhoneWithPassword(phone: string): Promise<User | null>;
  findByEmailWithPassword(email: string): Promise<User | null>;
  findByEmailAndPhone(email: string, phone: string): Promise<User | null>;
  updateLockoutStatus(id: string, attempts: number, isLocked: boolean, lockoutUntil: Date | null): Promise<void>;
  resetFailedAttempts(id: string): Promise<void>;
}

export interface ISessionRepository {
  revokeActiveSessionsForUser(userId: string): Promise<void>;
  findActiveByRefreshToken(hash: string): Promise<Session | null>;
  update(id: string, data: Partial<Session>): Promise<void>;
  findActiveByUserId(userId: string): Promise<Session[]>;
  findActiveByIdAndUser(id: string, userId: string): Promise<Session | null>;
  revokeById(id: string, reason: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<Session[]>;
  create(data: Omit<Session, 'createdAt'>): Promise<void>;
  revokeOthers(userId: string, currentSessionId: string, reason: string): Promise<void>;
}

export interface IActivityRepository {
  create(data: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<void>;
  findMany(filters: ActivityFilters & { limit?: number; offset?: number }): Promise<PaginatedResult<ActivityLog>>;
  findManyByUserId(userId: string, filters: ActivityFilters & { limit?: number; offset?: number }): Promise<PaginatedResult<ActivityLog>>;
  findByResourceId(resource: string, resourceId: string): Promise<ActivityLog[]>;
  findRecentByUserId(userId: string, limit: number): Promise<ActivityLog[]>;
}

export interface IBankAccountRepository {
  findById(id: string): Promise<BankAccount | null>;
  findByUserId(userId: string): Promise<BankAccount[]>;
  findPrimaryByUserId(userId: string): Promise<BankAccount | null>;
  create(data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<BankAccount>;
  update(id: string, data: Partial<BankAccount>): Promise<BankAccount | null>;
  delete(id: string): Promise<void>;
  setPrimary(id: string, userId: string): Promise<void>;
}

export interface INotificationRepository {
  upsertSubscription(userId: string, subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
    deviceName?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
  }): Promise<string>;
  deleteSubscription(userId: string, endpoint: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  getSubscriptionsByUserId(userId: string, onlyActive?: boolean): Promise<PushSubscription[]>;
  getAllActiveSubscriptions(): Promise<PushSubscription[]>;
  updateSubscriptionStatus(id: string, data: { isActive?: boolean; failedAttempts?: number; lastUsedAt?: Date }): Promise<void>;
  cleanupInactive(daysOld: number): Promise<number>;
}

export interface IImportExportRepository {
  createLog(data: Omit<ImportLog, 'createdAt' | 'deletedAt'>): Promise<void>;
  updateLog(id: string, data: Partial<ImportLog>): Promise<void>;
  getLogById(id: string, userId: string): Promise<ImportLog | null>;
  getLogsByIds(ids: string[], userId: string): Promise<ImportLog[]>;
  getLogsPaginated(userId: string, limit: number, offset: number): Promise<{ logs: ImportLog[]; total: number }>;
  deleteLogsByStatus(userId: string, status: string, olderThan: Date): Promise<number>;
  // Batch operations
  findUsersByIdentifiers(identifiers: string[]): Promise<Pick<User, 'id' | 'email' | 'phoneNumber'>[]>;
  createDebtsBatch(debts: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void>;
}

export interface IFileRepository {
  create(data: Omit<FileMetadata, 'createdAt'>): Promise<FileMetadata>;
  findById(id: string): Promise<FileMetadata | null>;
  findByUserIdAndType(userId: string, type: string): Promise<FileMetadata[]>;
  findByDebtIdAndType(debtId: string, type: string, status?: FileStatus): Promise<FileMetadata[]>;
  updateStatus(id: string, status: FileStatus, reviewerId: string, reason?: string): Promise<void>;
  deleteById(id: string): Promise<void>;
}

export interface IEmailVerificationRepository {
  invalidateExisting(userId: string, email: string): Promise<void>;
  create(data: Omit<EmailVerification, 'createdAt' | 'lastSentAt'>): Promise<void>;
  findLatestUnverified(email: string): Promise<EmailVerification | null>;
  updateAttempts(id: string, attempts: number): Promise<void>;
  markVerified(id: string): Promise<void>;
  findAllByUserIdAndEmail(userId: string, email: string): Promise<EmailVerification[]>;
  getPendingCount(userId: string): Promise<number>;
}

// Password reset logic bundled into UserRepo for now

export interface DebtFilterOptions {
  page?: number;
  limit?: number;
  offset?: number;
  status?: DebtStatus | 'all';
  debtorId?: string;
  creditorId?: string;
  uploadedById?: string;
  involvedUserId?: string;
  includeDeleted?: boolean;
}

export interface IDebtRepository {
  findById(id: string, includeDeleted?: boolean): Promise<Debt | null>;
  findMany(options: DebtFilterOptions): Promise<PaginatedResult<Debt>>;
  count(options: Omit<DebtFilterOptions, 'limit' | 'offset'>): Promise<number>;
  create(data: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Debt>;
  update(id: string, data: Partial<Debt>): Promise<Debt | null>;
  softDelete(id: string, deletedAt: Date): Promise<boolean>;
  findPotentialDuplicates(
    debtorPhone: string,
    creditorPhone: string,
    amount: number,
    amountTolerance: number,
    daysBack: number
  ): Promise<{ id: string; amount: number; description: string | null; createdAt: Date }[]>;
  getRecentContacts(userId: string, limit: number): Promise<string[]>;
  countActiveDebtsForPhone(phone: string): Promise<number>;
  countUnconfirmedByCreditor(creditorId: string): Promise<number>;
  batchSoftDelete(ids: string[], deletedAt: Date): Promise<{ deleted: string[]; notFound: string[] }>;
  softDeleteByUploader(uploadedById: string, deletedAt: Date): Promise<number>;
  linkDebtsToUser(userId: string, phoneNumber: string): Promise<void>;
  countByUserId(userId: string): Promise<{ total: number; pending: number; completed: number }>;
}
