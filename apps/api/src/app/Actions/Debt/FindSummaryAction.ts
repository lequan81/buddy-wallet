import { injectable, inject } from "tsyringe";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";

@injectable()
export class FindSummaryAction {
    constructor(@inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface) {
    }

    async execute(userId: string): Promise<{ total: number; pending: number; completed: number }> {
        return await this.debtRepo.countByUserId(userId);
    }
}
