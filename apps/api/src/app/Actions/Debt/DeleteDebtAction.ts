import { injectable, inject } from 'tsyringe';
import { hasPermission, PERMISSIONS } from '@/lib/security/permissions';
import { MAX_BATCH_DELETE_SIZE } from '@repo/config';
import type { Result, Debt } from '@repo/types';
import type { DebtRepositoryInterface } from '@/app/Repositories/Contracts';
import { LogAction } from '@/app/Actions/System/LogAction';

@injectable()
export class DeleteDebtAction {
  constructor(
    @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface,
    @inject(LogAction) private readonly logAction: LogAction
  ) {}

  async execute(
    debtId: string,
    currentUser: { id: string; permissions: string[] | null },
    preloadedDebt?: Debt | null
  ): Promise<Result<void>> {
    const debt = preloadedDebt || await this.debtRepo.findById(debtId);
    if (!debt) return { code: 'DEBT_NOT_FOUND' };

    const isAdmin = hasPermission(currentUser.permissions || [], PERMISSIONS.DEBT_DELETE_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) return { code: 'DEBT_PERMISSION_DENIED' };

    await this.debtRepo.softDelete(debtId, new Date());
    await this.logAction.execute({
      userId: currentUser.id, action: 'delete' as const, resource: 'debt', resourceId: debtId
    });

    return { data: undefined };
  }

  async executeBatch(
    debtIds: string[],
    currentUser: { id: string; permissions: string[] | null }
  ): Promise<{ deleted: number; errors: string[] }> {
    if (debtIds.length > MAX_BATCH_DELETE_SIZE) {
      return { deleted: 0, errors: [`Maximum ${MAX_BATCH_DELETE_SIZE} debts can be deleted at once`] };
    }

    const isAdmin = hasPermission(currentUser.permissions || [], PERMISSIONS.DEBT_DELETE_ALL);
    const toDelete: string[] = [];
    const errors: string[] = [];

    if (!isAdmin) {
      const foundDebts = await this.debtRepo.findByIds(debtIds);
      const debtsById = new Map(foundDebts.map(d => [d.id, d]));
      for (const id of debtIds) {
        const d = debtsById.get(id);
        if (!d) errors.push(`Debt ${id} not found`);
        else if (d.uploadedById !== currentUser.id) errors.push(`Unauthorized to delete debt ${id}`);
        else toDelete.push(id);
      }
    } else {
      toDelete.push(...debtIds);
    }

    const result = await this.debtRepo.batchSoftDelete(toDelete, new Date());
    errors.push(...result.notFound.map(id => `Debt ${id} not found`));

    return { deleted: result.deleted.length, errors };
  }

  async executeAllForUser(userId: string): Promise<{ deleted: number }> {
    const deleted = await this.debtRepo.softDeleteByUploader(userId, new Date());
    return { deleted };
  }
}
