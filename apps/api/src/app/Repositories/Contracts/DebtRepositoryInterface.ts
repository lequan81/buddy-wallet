import type { Debt as DebtEntity, NewDebt as CreateDebtData } from '@repo/db';
import type { DebtStatus, PaginationOptions, PaginatedResult } from '@repo/types';

export interface DebtFilterOptions extends PaginationOptions {
  status?: DebtStatus | 'all';
  debtorId?: string;
  creditorId?: string;
  uploadedById?: string;
  involvedUserId?: string;
  includeDeleted?: boolean;
}

export interface DebtRepositoryInterface {
  findById(id: string, includeDeleted?: boolean): Promise<DebtEntity | null>;
  findByIds(ids: string[], includeDeleted?: boolean): Promise<DebtEntity[]>;
  findMany(options: DebtFilterOptions): Promise<PaginatedResult<DebtEntity>>;
  count(options: Omit<DebtFilterOptions, 'limit' | 'offset'>): Promise<number>;
  create(data: CreateDebtData): Promise<DebtEntity>;
  update(id: string, data: Partial<DebtEntity> & { updatedAt: Date }): Promise<DebtEntity | null>;
  softDelete(id: string, deletedAt: Date): Promise<boolean>;
  findPotentialDuplicates(
    debtorPhone: string | null,
    creditorPhone: string | null,
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

