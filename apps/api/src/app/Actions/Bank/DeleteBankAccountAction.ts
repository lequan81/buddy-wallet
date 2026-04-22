import { injectable, inject } from "tsyringe";
import { log } from "@repo/logger";
import type { Result } from "@repo/types";
import type { BankAccountRepositoryInterface } from "@/app/Repositories/Contracts";

@injectable()
export class DeleteBankAccountAction {
    constructor(@inject('BankAccountRepositoryInterface') private bankRepo: BankAccountRepositoryInterface) {
    }

    async execute(id: string, userId: string): Promise<Result<void>> {
        const account = await this.bankRepo.findById(id);

        if (!account) {
          return { code: 'NOT_FOUND', error: 'Account not found' };
        }

        if (account.userId !== userId) {
          return { code: 'UNAUTHORIZED', error: 'Not authorized' };
        }

        await this.bankRepo.delete(id);
        log.debug('BANK', 'Account deleted', { id, userId });

        return { data: undefined };
    }
}
