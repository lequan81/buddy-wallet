import { bankAccounts, eq, and, sql } from '@repo/db';
import type { BankAccount, DbClient } from '@repo/db';
import { randomUUIDv7 } from 'bun';
import { db } from '@/providers/database';
import { t } from 'elysia';
import { TypeCompiler } from '@sinclair/typebox/compiler';

// ── TypeBox Validation Schemas ────────────────────────────────
const InsertBankAccountSchema = t.Object({
  userId: t.String({ minLength: 1 }),
  bankCode: t.String({ minLength: 1 }),
  bankName: t.String({ minLength: 1 }),
  bankBin: t.String({ minLength: 1 }),
  accountNumber: t.String({ minLength: 4 }),
  accountName: t.Optional(t.Union([t.String(), t.Null()])),
  isDefault: t.Optional(t.Boolean())
});

const insertBankAccountValidator = TypeCompiler.Compile(InsertBankAccountSchema);

/**
 * Bank Account Repository
 * Data access layer for bank account operations
 * No DI container - uses direct db instance
 */
export class BankAccountRepository {
  constructor(private readonly database: DbClient = db) {}

  async findById(id: string): Promise<BankAccount | null> {
    const result = await this.database
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, id))
      .get();
    return (result as BankAccount) || null;
  }

  async findByUserId(userId: string, limit?: number, offset?: number): Promise<{ data: BankAccount[]; total: number }> {
    const [data, countResult] = await Promise.all([
      this.database.select()
        .from(bankAccounts)
        .where(eq(bankAccounts.userId, userId))
        .limit(limit ?? 100)
        .offset(offset ?? 0)
        .all(),
      this.database
        .select({ count: sql<number>`count(*)` })
        .from(bankAccounts)
        .where(eq(bankAccounts.userId, userId))
        .get()
    ]);

    return {
      data: data as BankAccount[],
      total: Number(countResult?.count ?? 0)
    };
  }

  async findPrimaryByUserId(userId: string): Promise<BankAccount | null> {
    const result = await this.database
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.isDefault, true)))
      .get();
    return (result as BankAccount) || null;
  }

  async create(data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<BankAccount> {
    if (!insertBankAccountValidator.Check(data)) {
      const errors = [...insertBankAccountValidator.Errors(data)];
      throw new Error(`Bank account validation failed: ${errors[0]?.message ?? 'Invalid data'}`);
    }
    const id = randomUUIDv7();
    const [result] = await this.database.insert(bankAccounts).values({
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result as BankAccount;
  }

  async update(id: string, data: Partial<BankAccount>): Promise<BankAccount | null> {
    const [result] = await this.database.update(bankAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bankAccounts.id, id))
      .returning();
    return (result as BankAccount) || null;
  }

  async delete(id: string): Promise<void> {
    await this.database.delete(bankAccounts).where(eq(bankAccounts.id, id));
  }

  async setPrimary(id: string, userId: string): Promise<void> {
    await this.database.transaction(async (tx) => {
      // Unset previous default
      await tx.update(bankAccounts)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(bankAccounts.userId, userId));

      // Set new default
      await tx.update(bankAccounts)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(bankAccounts.id, id));
    });
  }

  async unsetDefaultAccounts(userId: string): Promise<void> {
    await this.database.update(bankAccounts)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(bankAccounts.userId, userId));
  }

  async countByUserId(userId: string): Promise<number> {
    const result = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId))
      .get();

    return result?.count ?? 0;
  }
}
