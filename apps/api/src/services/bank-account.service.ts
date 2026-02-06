/**
 * Bank Account Service
 *
 * Handles CRUD operations for user bank accounts.
 */
import { bankAccounts, eq, and, desc } from '@repo/db';
import { log } from '@utils/logger';
import type { DbClient } from '@/types';
import type { BankAccount, NewBankAccount } from '@repo/db';

export class BankAccountService {
  constructor(private db: DbClient) {}

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
        await this.db
          .update(bankAccounts)
          .set({ isDefault: false })
          .where(eq(bankAccounts.userId, data.userId))
          .run();
      }

      // Generate ID
      const id = Bun.randomUUIDv7();
      const now = new Date();

      const newAccount: typeof bankAccounts.$inferInsert = {
        ...data,
        id,
        createdAt: now,
        updatedAt: now
      };

      this.db.insert(bankAccounts).values(newAccount).run();

      log.debug('BANK', 'Account added', { userId: data.userId, bankCode: data.bankCode });

      return {
        success: true,
        account: newAccount as BankAccount
      };
    } catch (err) {
      log.error('BANK', 'Failed to add account', { error: String(err) });
      return { success: false, error: 'Failed to add bank account' };
    }
  }

  /**
   * Get all bank accounts for a user
   */
  async getUserBankAccounts(userId: string): Promise<BankAccount[]> {
    return this.db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId))
      .orderBy(desc(bankAccounts.isDefault), desc(bankAccounts.createdAt))
      .all();
  }

  /**
   * Delete a bank account
   */
  async deleteBankAccount(
    id: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const account = this.db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).get();

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    if (account.userId !== userId) {
      return { success: false, error: 'Not authorized' };
    }

    this.db.delete(bankAccounts).where(eq(bankAccounts.id, id)).run();
    log.debug('BANK', 'Account deleted', { id, userId });

    return { success: true };
  }
}
