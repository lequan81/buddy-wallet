import { injectable, inject } from 'tsyringe';
import type {
  DebtStatus,
  Debt,
  PaginatedResult,
  DebtDetails,
  PaginationOptions
} from '@repo/types';
import type { DebtRepositoryInterface } from '@/app/Repositories/Contracts/DebtRepositoryInterface';
import { toDebtDetails } from '@/lib/mappers/debt';

/**
 * DebtQueryService - Handles all read-only debt operations
 */
@injectable()
export class DebtQueryService {
  constructor(
    @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface
  ) {}

  async getDebts(
    userId: string,
    options: PaginationOptions & { viewAll?: boolean } = {}
  ): Promise<PaginatedResult<DebtDetails>> {
    const status = (options.status as any) || 'all';
    const result = await this.debtRepo.findMany({
      ...options,
      status,
      involvedUserId: options.viewAll ? undefined : userId
    });

    return {
      items: result.items.map(toDebtDetails),
      pagination: result.pagination
    };
  }

  async getDebtById(debtId: string): Promise<DebtDetails | null> {
    const debt = await this.debtRepo.findById(debtId);
    return debt ? toDebtDetails(debt) : null;
  }

  async getRecentContacts(userId: string, limit: number = 10): Promise<string[]> {
    return this.debtRepo.getRecentContacts(userId, limit);
  }

  async countActiveDebtsForPhone(phone: string): Promise<number> {
    return this.debtRepo.countActiveDebtsForPhone(phone);
  }

  async findById(debtId: string): Promise<Debt | null> {
    return this.debtRepo.findById(debtId);
  }

  async findByIds(debtIds: string[]): Promise<Debt[]> {
    return this.debtRepo.findByIds(debtIds);
  }

  async findPotentialDuplicates(
    debtorPhone: string,
    creditorPhone: string,
    amount: number,
    tolerance: number,
    days: number
  ): Promise<{ id: string; amount: number; description: string | null; createdAt: Date }[]> {
    return this.debtRepo.findPotentialDuplicates(debtorPhone, creditorPhone, amount, tolerance, days);
  }
}
