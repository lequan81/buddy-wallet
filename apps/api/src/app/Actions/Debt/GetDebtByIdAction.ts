import { injectable, inject } from "tsyringe";
import type { DebtDetails } from "@repo/types";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";
import { toDebtDetails } from "@/lib/mappers/debt";

@injectable()
export class GetDebtByIdAction {
    constructor(@inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface) {
    }

    async execute(debtId: string): Promise<DebtDetails | null> {
        const debt = await this.debtRepo.findById(debtId);
        return debt ? toDebtDetails(debt) : null;
    }
}
