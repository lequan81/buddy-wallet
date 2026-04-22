import { injectable, inject } from "tsyringe";
import type { Debt } from "@repo/types";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";

@injectable()
export class FindByIdsAction {
    constructor(@inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface) {
    }

    async execute(debtIds: string[]): Promise<Debt[]> {
        return this.debtRepo.findByIds(debtIds);
    }
}
