import { injectable, inject } from "tsyringe";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";

@injectable()
export class CountActiveDebtsForPhoneAction {
    constructor(@inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface) {
    }

    async execute(phone: string): Promise<number> {
        return this.debtRepo.countActiveDebtsForPhone(phone);
    }
}
