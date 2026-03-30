import type { DebtStatus } from '@repo/config';
import type { Debt } from '../core/debt';
import type { PaginatedResult } from '../api/pagination';

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
