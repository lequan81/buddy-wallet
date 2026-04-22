import { injectable, inject } from "tsyringe";
import type { DebtRepositoryInterface } from "@/app/Repositories/Contracts/DebtRepositoryInterface";

@injectable()
export class FindPotentialDuplicatesAction {
    constructor(@inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface) {
    }

    async execute(debtorPhone: string, creditorPhone: string, amount: number, tolerance: number, days: number): Promise<{ id: string; amount: number; description: string | null; createdAt: Date }[]> {
        return this.debtRepo.findPotentialDuplicates(debtorPhone, creditorPhone, amount, tolerance, days);
    }
}
