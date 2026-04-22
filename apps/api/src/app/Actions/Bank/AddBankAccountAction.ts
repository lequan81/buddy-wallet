import { injectable, inject } from "tsyringe";
import { log } from "@repo/logger";
import type { Result, BankAccount } from "@repo/types";
import type { BankAccountRepositoryInterface } from "@/app/Repositories/Contracts";

@injectable()
export class AddBankAccountAction {
    constructor(@inject('BankAccountRepositoryInterface') private bankRepo: BankAccountRepositoryInterface) {
    }

    async execute(data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<BankAccount>> {
        try {
          // If new account is default, unset existing default
          if (data.isDefault) {
            await this.bankRepo.setPrimary('', data.userId); // Empty ID means just unset others
          }

          const account = await this.bankRepo.create({
            ...data,
            accountName: data.accountName ?? null,
            isDefault: data.isDefault ?? false
          });

          log.debug('BANK', 'Account added', { userId: data.userId, bankCode: data.bankCode });

          return { data: account };
        } catch (err) {
          log.error('BANK', 'Failed to add account', { error: String(err) });
          return { code: 'ADD_ACCOUNT_FAILED', error: 'Failed to add bank account' };
        }
    }
}
