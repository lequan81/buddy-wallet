import { injectable, inject } from "tsyringe";
import { log } from "@repo/logger";
import type { Result, BankAccount } from "@repo/types";
import type { BankAccountRepositoryInterface } from "@/app/Repositories/Contracts";

@injectable()
export class UpdateBankAccountAction {
    constructor(@inject('BankAccountRepositoryInterface') private bankRepo: BankAccountRepositoryInterface) {
    }

    async execute(id: string, userId: string, data: Partial<Omit<BankAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<Result<BankAccount>> {
        try {
          const account = await this.bankRepo.findById(id);

          if (!account) {
            return { code: 'NOT_FOUND', error: 'Account not found' };
          }

          if (account.userId !== userId) {
            return { code: 'UNAUTHORIZED', error: 'Not authorized' };
          }

          // If updating to default, handle it via repo
          if (data.isDefault) {
            await this.bankRepo.setPrimary(id, userId);
          }

          const updatedAccount = await this.bankRepo.update(id, data);

          log.debug('BANK', 'Account updated', { id, userId });

          return { data: updatedAccount as BankAccount };
        } catch (err) {
          log.error('BANK', 'Failed to update account', { error: String(err) });
          return { code: 'UPDATE_ACCOUNT_FAILED', error: 'Failed to update bank account' };
        }
    }
}
