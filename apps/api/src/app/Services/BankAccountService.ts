/**
 * Bank Account Service
 *
 * Handles CRUD operations for user bank accounts.
 */
import { injectable, inject } from 'tsyringe';
import { log } from '@repo/logger';
import type { Result, BankAccount } from '@repo/types';
import type { BankAccountRepositoryInterface } from '@/app/Repositories/Contracts';

@injectable()
export class BankAccountService {
  constructor(@inject('BankAccountRepositoryInterface') private bankRepo: BankAccountRepositoryInterface) {}

  /**
   * Add a new bank account
   * If set as default, unsets other default accounts for the user.
   */
  async addBankAccount(data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<BankAccount>> {
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

  /**
   * Update a bank account
   * If set as default, unsets other default accounts for the user.
   */
  async updateBankAccount(
    id: string,
    userId: string,
    data: Partial<Omit<BankAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<Result<BankAccount>> {
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

  /**
   * Get all bank accounts for a user
   */
  async getUserBankAccounts(userId: string): Promise<Result<BankAccount[]>> {
    try {
      const accounts = await this.bankRepo.findByUserId(userId);
      return { data: accounts };
    } catch (err) {
      log.error('BANK', 'Failed to get accounts', { error: String(err) });
      return { code: 'GET_ACCOUNTS_FAILED', error: 'Failed to retrieve bank accounts' };
    }
  }

  /**
   * Delete a bank account
   */
  async deleteBankAccount(
    id: string,
    userId: string
  ): Promise<Result<void>> {
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

