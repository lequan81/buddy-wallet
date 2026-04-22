import { injectable, inject } from "tsyringe";
import type { Debt } from "@repo/types";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";

@injectable()
export class FindByIdAction {
    constructor(@inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface) {
    }

    async execute(debtId: string): Promise<Debt | null> {
        return this.debtRepo.findById(debtId);
    }
}
