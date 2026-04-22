import { injectable, inject } from "tsyringe";
import { hasPermission, PERMISSIONS } from "@/lib/security/permissions";
import type { DebtStatus, Result, DebtDetails, Debt as DebtRecord } from "@repo/types";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";
import { Debt } from "@/app/Models/Debt";
import { ActivityService } from "@/app/Services/ActivityService";
import { toDebtDetails } from "@/lib/mappers/debt";

@injectable()
export class UpdateDebtStatusAction {
    constructor(
      @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface, 
      @inject(ActivityService) private readonly activityService: ActivityService
    ) {}

    async execute(debtId: string, newStatus: DebtStatus, currentUser: { id: string; permissions: string[] | null }, preloadedDebt?: DebtRecord | null): Promise<Result<{ debt: DebtDetails; previousStatus: string; newStatus: string }>> {
        const debt = preloadedDebt || await this.debtRepo.findById(debtId);
        if (!debt) return { code: 'NOT_FOUND' };

        const isAdmin = hasPermission(currentUser.permissions || [], PERMISSIONS.DEBT_VIEW_ALL);
        const isInvolved = debt.debtorId === currentUser.id || debt.creditorId === currentUser.id;
        if (!isAdmin && !isInvolved) {
          return { code: 'DEBT_PERMISSION_DENIED' };
        }

        const now = new Date();

        // Convert database row to Debt domain model for business logic
        const debtModel = new Debt(
          debt.id,
          debt.amount,
          debt.currency,
          debt.debtorId,
          debt.creditorId,
          debt.status as DebtStatus,
          new Date(debt.createdAt),
          new Date(debt.updatedAt),
          debt.description ?? undefined
        );

        // Validate transition is possible
        try {
          let updatedDebt: Debt;

          switch (newStatus) {
            case 'confirmed':
              updatedDebt = debtModel.confirm(currentUser.id);
              break;
            case 'disputed':
              updatedDebt = debtModel.dispute(currentUser.id);
              break;
            case 'cancelled':
              updatedDebt = debtModel.cancel(currentUser.id);
              break;
            case 'paid':
              updatedDebt = debtModel.markAsPaid(currentUser.id);
              break;
            default:
              return {
                code: 'DEBT_INVALID_STATUS',
                error: `Invalid status: ${newStatus}`
              };
          }

          const updated = await this.debtRepo.update(debtId, {
            status: updatedDebt.status as DebtStatus,
            updatedAt: now
          });
          if (!updated) return { code: 'NOT_FOUND' };

          await this.activityService.log({
            userId: currentUser.id,
            action: newStatus as 'confirmed' | 'disputed' | 'paid' | 'cancelled',
            resource: 'debt',
            resourceId: debtId,
            changes: { before: { status: debt.status }, after: { status: newStatus } }
          });

          return {
            data: {
              debt: toDebtDetails(updated as any),
              previousStatus: debt.status,
              newStatus
            }
          };
        } catch (error) {
          return {
            code: 'DEBT_INVALID_TRANSITION',
            error: (error as Error).message
          };
        }
    }
}
