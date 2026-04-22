import { injectable, inject } from 'tsyringe';
import { hasPermission, PERMISSIONS } from '@/lib/security/permissions';
import { DEBT_STATUS } from '@repo/config';
import type { Result, DebtDetails, Debt } from '@repo/types';
import { BE_ERRORS } from '@repo/errors';
import type { DebtRepositoryInterface } from '@/app/Repositories/Contracts';
import { LogAction } from '@/app/Actions/System/LogAction';
import { toDebtDetails } from "@/lib/mappers/debt";

@injectable()
export class UpdateDebtAction {
  constructor(
    @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface,
    @inject(LogAction) private readonly logAction: LogAction
  ) {}

  async execute(
    debtId: string,
    data: { description?: string; amount?: number },
    currentUser: { id: string; permissions: string[] | null },
    preloadedDebt?: Debt | null
  ): Promise<Result<{ debt: DebtDetails }>> {
    const debt = preloadedDebt || await this.debtRepo.findById(debtId);
    if (!debt) return { code: 'DEBT_NOT_FOUND', error: BE_ERRORS.DEBT_NOT_FOUND.message };

    const isAdmin = hasPermission(currentUser.permissions || [], PERMISSIONS.DEBT_VIEW_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) {
      return { code: 'DEBT_PERMISSION_DENIED', error: BE_ERRORS.DEBT_PERMISSION_DENIED.message };
    }

    if (debt.status !== DEBT_STATUS.PENDING && debt.status !== DEBT_STATUS.DISPUTED) {
      return { code: 'DEBT_INVALID_STATUS', error: `Only pending or disputed debts can be edited.` };
    }

    const updated = await this.debtRepo.update(debtId, {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amount !== undefined && { amount: data.amount }),
      updatedAt: new Date()
    });

    if (!updated) return { code: 'DEBT_NOT_FOUND' };

    await this.logAction.execute({
      userId: currentUser.id, action: 'update', resource: 'debt', resourceId: debtId, changes: { after: data }
    });

    return { data: { debt: toDebtDetails(updated as any) } };
  }
}
