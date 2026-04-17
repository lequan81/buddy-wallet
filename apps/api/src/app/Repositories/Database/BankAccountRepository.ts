import { injectable } from 'tsyringe';
import { db, bankAccounts, eq, and, sql } from '@repo/db';
import type { BankAccount } from '@repo/db';
import type { BankAccountRepositoryInterface } from '../Contracts/BankAccountRepositoryInterface';
import { randomUUIDv7 } from 'bun';

@injectable()
export class BankAccountRepository implements BankAccountRepositoryInterface {
  async findById(id: string): Promise<BankAccount | null> {
    const result = await db.query.bankAccounts.findFirst({
      where: (acc, { eq }) => eq(acc.id, id)
    });
    return result || null;
  }

  async findByUserId(userId: string): Promise<BankAccount[]> {
    return db.query.bankAccounts.findMany({
      where: (acc, { eq }) => eq(acc.userId, userId)
    });
  }

  async findPrimaryByUserId(userId: string): Promise<BankAccount | null> {
    const result = await db.query.bankAccounts.findFirst({
      where: (acc, { and, eq }) => and(eq(acc.userId, userId), eq(acc.isPrimary, true))
    });
    return result || null;
  }

  async create(data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<BankAccount> {
    const id = randomUUIDv7();
    const [result] = await db.insert(bankAccounts).values({
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result;
  }

  async update(id: string, data: Partial<BankAccount>): Promise<BankAccount | null> {
    const [result] = await db.update(bankAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bankAccounts.id, id))
      .returning();
    return result || null;
  }

  async delete(id: string): Promise<void> {
    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
  }

  async setPrimary(id: string, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Unset previous primary
      await tx.update(bankAccounts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(bankAccounts.userId, userId));
      
      // Set new primary
      await tx.update(bankAccounts)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(bankAccounts.id, id));
    });
  }
}
