import type { DebtStatus } from '@repo/config';
import type { PaginationOptions as ApiPaginationOptions, PaginatedResult, ExpiryOption } from '../api/pagination';
import type { SafeUser } from '../core/user';
import type { DebtDetails, CreateDebtInput, DebtResult, StatusUpdateResult } from '../core/debt';

export interface IDebtService {
  getDebtsByUserId(userId: string, options?: ApiPaginationOptions): Promise<PaginatedResult<DebtDetails>>;
  countActiveDebtsForPhone(phone: string): Promise<number>;
  getDebtById(debtId: string): Promise<DebtDetails | undefined>;
  createDebt(input: CreateDebtInput & { expiryOption?: ExpiryOption; confirmDuplicate?: boolean }, currentUser: SafeUser): Promise<DebtResult>;
  updateDebtStatus(debtId: string, newStatus: DebtStatus, currentUser: SafeUser): Promise<StatusUpdateResult>;
}
