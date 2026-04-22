import { injectable, inject } from "tsyringe";
import { DEBT_STATUS } from "@repo/config";
import type { Result, DebtDetails, Debt } from "@repo/types";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";
import { toDebtDetails } from "@/lib/mappers/debt";

@injectable()
export class SuggestEditAction {
    constructor(
      @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface
    ) {}

    async execute(debtId: string, currentUser: { id: string }, suggestion: { amount?: number; description?: string }, preloadedDebt?: Debt | null): Promise<Result<{ debt: DebtDetails; message: string }>> {
        if (!suggestion.amount && !suggestion.description) {
          return { code: 'INVALID_INPUT', error: 'Provide at least amount or description' };
        }

        const debt = preloadedDebt || await this.debtRepo.findById(debtId);
        if (!debt) return { code: 'NOT_FOUND' };

        if (debt.creditorId !== currentUser.id && debt.debtorId !== currentUser.id) return { code: 'DEBT_PERMISSION_DENIED' };
        if (debt.uploadedById === currentUser.id) return { code: 'FORBIDDEN', error: 'Creators cannot suggest edits' };
        if (debt.status === DEBT_STATUS.PAID || debt.status === DEBT_STATUS.CANCELLED) return { code: 'INVALID_STATE' };

        const updated = await this.debtRepo.update(debtId, {
          suggestedAmount: suggestion.amount ?? null,
          suggestedDescription: suggestion.description ?? null,
          suggestedById: currentUser.id,
          suggestedAt: new Date(),
          updatedAt: new Date()
        });

        if (!updated) return { code: 'NOT_FOUND' };

        return { data: { debt: toDebtDetails(updated as any), message: 'Edit suggestion sent' } };
    }
}
