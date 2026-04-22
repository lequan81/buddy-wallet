import { injectable, inject } from "tsyringe";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";

@injectable()
export class GetRecentContactsAction {
    constructor(@inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface) {
    }

    async execute(userId: string, limit: number = 10): Promise<string[]> {
        return this.debtRepo.getRecentContacts(userId, limit);
    }
}
