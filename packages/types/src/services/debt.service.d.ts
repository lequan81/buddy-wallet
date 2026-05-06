import type { PaginationOptions as ApiPaginationOptions, PaginatedResult, ExpiryOption } from '../api/pagination';
import type { UserResponse } from '../core/user';
import type { DebtDetails, CreateDebtInput, DebtResult, StatusUpdateResult, DebtStatus } from '../core/debt';

export interface IDebtService {
  getDebtsByUserId(userId: string, options?: ApiPaginationOptions): Promise<PaginatedResult<DebtDetails>>;
  countActiveDebtsForPhone(phone: string): Promise<number>;
  getDebtById(debtId: string): Promise<DebtDetails | undefined>;
  createDebt(input: CreateDebtInput & { expiryOption?: ExpiryOption; confirmDuplicate?: boolean }, currentUser: UserResponse): Promise<DebtResult>;
  updateDebtStatus(debtId: string, newStatus: DebtStatus, currentUser: UserResponse): Promise<StatusUpdateResult>;
}
