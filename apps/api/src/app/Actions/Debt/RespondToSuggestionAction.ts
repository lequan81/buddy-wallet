import { injectable, inject } from "tsyringe";
import type { Result, DebtDetails, Debt } from "@repo/types";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";
import { toDebtDetails } from "@/lib/mappers/debt";

@injectable()
export class RespondToSuggestionAction {
    constructor(
      @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface
    ) {}

    async execute(debtId: string, currentUser: { id: string }, accept: boolean, preloadedDebt?: Debt | null): Promise<Result<{ debt: DebtDetails; message: string }>> {
        const debt = preloadedDebt || await this.debtRepo.findById(debtId);
        if (!debt) return { code: 'NOT_FOUND' };

        if (debt.uploadedById !== currentUser.id) return { code: 'DEBT_PERMISSION_DENIED' };
        if (!debt.suggestedById) return { code: 'INVALID_STATE', error: 'No pending suggestion' };

        const now = new Date();
        const clearSuggestion = {
          suggestedAmount: null,
          suggestedDescription: null,
          suggestedById: null,
          suggestedAt: null,
          updatedAt: now
        };

        const updates = accept
          ? {
              ...clearSuggestion,
              amount: debt.suggestedAmount ?? debt.amount,
              description: debt.suggestedDescription ?? debt.description
            }
          : clearSuggestion;

        const updated = await this.debtRepo.update(debtId, updates);
        if (!updated) return { code: 'NOT_FOUND' };

        return {
          data: {
            debt: toDebtDetails(updated as any),
            message: accept ? 'Suggestion accepted' : 'Suggestion rejected'
          }
        };
    }
}
