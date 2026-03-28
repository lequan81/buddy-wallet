import { bankAccounts, eq, desc, and } from '@repo/db';
import type { DbClient } from '@/types';
import type { IBankAccountRepository } from '@repo/types';
import type { BankAccount } from '@repo/db';

export class DrizzleBankAccountRepository implements IBankAccountRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<BankAccount | null> {
    const result = await this.db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).get();
    return (result as BankAccount) || null;
  }

  async findByUserId(userId: string): Promise<BankAccount[]> {
    return this.db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId))
      .orderBy(desc(bankAccounts.isDefault), desc(bankAccounts.createdAt))
      .all() as BankAccount[];
  }

  async findPrimaryByUserId(userId: string): Promise<BankAccount | null> {
    const result = await this.db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.isDefault, true)))
      .get();
    return (result as BankAccount) || null;
  }

  async create(data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<BankAccount> {
    const id = Bun.randomUUIDv7();
    const now = new Date();
    const result = await this.db.insert(bankAccounts).values({
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    }).returning();
    return result[0] as BankAccount;
  }

  async update(id: string, data: Partial<BankAccount>): Promise<BankAccount | null> {
    const result = await this.db
      .update(bankAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bankAccounts.id, id))
      .returning();
    return (result[0] as BankAccount) || null;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(bankAccounts).where(eq(bankAccounts.id, id)).run();
  }

  async setPrimary(id: string, userId: string): Promise<void> {
    // Unset current primary
    await this.db
      .update(bankAccounts)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.isDefault, true)))
      .run();

    // Set new primary
    await this.db
      .update(bankAccounts)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(bankAccounts.id, id))
      .run();
  }
}
