/**
 * Bank Account Service
 *
 * Handles CRUD operations for user bank accounts.
 */
import { log } from '@repo/logger';
import type { IBankAccountRepository } from '@repo/types';
import type { BankAccount, NewBankAccount } from '@repo/db';

export class BankAccountService {
  constructor(private bankRepo: IBankAccountRepository) {}

  /**
   * Add a new bank account
   * If set as default, unsets other default accounts for the user.
   */
  async addBankAccount(data: Omit<NewBankAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
    success: boolean;
    error?: string;
    account?: BankAccount;
  }> {
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

      return {
        success: true,
        account
      };
    } catch (err) {
      log.error('BANK', 'Failed to add account', { error: String(err) });
      return { success: false, error: 'Failed to add bank account' };
    }
  }

  /**
   * Update a bank account
   * If set as default, unsets other default accounts for the user.
   */
  async updateBankAccount(
    id: string,
    userId: string,
    data: Partial<Omit<NewBankAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<{
    success: boolean;
    error?: string;
    account?: BankAccount;
  }> {
    try {
      const account = await this.bankRepo.findById(id);

      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      if (account.userId !== userId) {
        return { success: false, error: 'Not authorized' };
      }

      // If updating to default, handle it via repo
      if (data.isDefault) {
        await this.bankRepo.setPrimary(id, userId);
      }

      const updatedAccount = await this.bankRepo.update(id, data);

      log.debug('BANK', 'Account updated', { id, userId });

      return {
        success: true,
        account: updatedAccount as BankAccount
      };
    } catch (err) {
      log.error('BANK', 'Failed to update account', { error: String(err) });
      return { success: false, error: 'Failed to update bank account' };
    }
  }

  /**
   * Get all bank accounts for a user
   */
  async getUserBankAccounts(userId: string): Promise<BankAccount[]> {
    return this.bankRepo.findByUserId(userId);
  }

  /**
   * Delete a bank account
   */
  async deleteBankAccount(
    id: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const account = await this.bankRepo.findById(id);

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    if (account.userId !== userId) {
      return { success: false, error: 'Not authorized' };
    }

    await this.bankRepo.delete(id);
    log.debug('BANK', 'Account deleted', { id, userId });

    return { success: true };
  }
}
