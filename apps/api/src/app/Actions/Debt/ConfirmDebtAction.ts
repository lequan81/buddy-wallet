import { injectable, inject } from "tsyringe";
import { logger } from "@repo/logger";
import type { Result, DebtDetails, Debt } from "@repo/types";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";
import { PushService } from "@/app/Services/PushService";
import { ActivityService } from "@/app/Services/ActivityService";
import { toDebtDetails } from "@/lib/mappers/debt";

@injectable()
export class ConfirmDebtAction {
    constructor(
      @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface, 
      @inject(PushService) private readonly pushService: PushService, 
      @inject(ActivityService) private readonly activityService: ActivityService
    ) {}

    async execute(debtId: string, currentUser: { id: string; phoneNumber: string | null }, preloadedDebt?: Debt | null): Promise<Result<{ debt: DebtDetails; message: string }>> {
        const debt = preloadedDebt || await this.debtRepo.findById(debtId);
        if (!debt) return { code: 'NOT_FOUND' };

        const isCreditor = debt.creditorId === currentUser.id;
        const isDebtor = debt.debtorId === currentUser.id;

        if (!isCreditor && !isDebtor) return { code: 'DEBT_PERMISSION_DENIED' };
        if (debt.uploadedById === currentUser.id) return { code: 'DEBT_ALREADY_CONFIRMED' };

        const now = new Date();
        const updates: {
          updatedAt: Date;
          confirmedByCreditor?: boolean;
          creditorConfirmedAt?: Date;
          confirmedByDebtor?: boolean;
          debtorConfirmedAt?: Date;
          needsConfirmation?: boolean;
        } = { updatedAt: now };

        if (isCreditor) {
          updates.confirmedByCreditor = true;
          updates.creditorConfirmedAt = now;
        }
        if (isDebtor) {
          updates.confirmedByDebtor = true;
          updates.debtorConfirmedAt = now;
        }

        const willBeFullyConfirmed =
          (updates.confirmedByCreditor || debt.confirmedByCreditor) &&
          (updates.confirmedByDebtor || debt.confirmedByDebtor);
        if (willBeFullyConfirmed) updates.needsConfirmation = false;

        const updated = await this.debtRepo.update(debtId, updates);
        if (!updated) return { code: 'NOT_FOUND' };

        await this.activityService.log({
          userId: currentUser.id,
          action: 'confirm',
          resource: 'debt',
          resourceId: debtId
        });

        // Notify uploader
        if (debt.uploadedById) {
          this.pushService.sendDebtConfirmedNotification({
            userId: debt.uploadedById,
            confirmerName: currentUser.phoneNumber || 'Counterparty',
            amount: debt.amount,
            description: debt.description || 'No description',
            debtId
          }).catch(err => logger.error('Failed to send push', { err }));
        }

        return {
          data: {
            debt: toDebtDetails(updated as any),
            message: 'Debt confirmed successfully'
          }
        };
    }
}
