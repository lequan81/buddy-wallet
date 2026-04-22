import { injectable, inject } from "tsyringe";
import { log } from "@repo/logger";
import type { Result, BankAccount } from "@repo/types";
import type { BankAccountRepositoryInterface } from "@/app/Repositories/Contracts";

@injectable()
export class GetUserBankAccountsAction {
    constructor(@inject('BankAccountRepositoryInterface') private bankRepo: BankAccountRepositoryInterface) {
    }

    async execute(userId: string): Promise<Result<BankAccount[]>> {
        try {
          const accounts = await this.bankRepo.findByUserId(userId);
          return { data: accounts };
        } catch (err) {
          log.error('BANK', 'Failed to get accounts', { error: String(err) });
          return { code: 'GET_ACCOUNTS_FAILED', error: 'Failed to retrieve bank accounts' };
        }
    }
}
