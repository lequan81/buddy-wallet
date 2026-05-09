import { bankAccounts, eq, and, sql } from '@repo/db';
import type { BankAccount, DbClient } from '@repo/db';
import { randomUUIDv7 } from 'bun';
import { db } from '@/providers/database';
import * as v from 'valibot';

// ── Valibot Validation Schemas ────────────────────────────────
const InsertBankAccountSchema = v.object({
  userId: v.pipe(v.string(), v.minLength(1)),
  bankCode: v.pipe(v.string(), v.minLength(1)),
  bankName: v.pipe(v.string(), v.minLength(1)),
  bankBin: v.pipe(v.string(), v.minLength(1)),
  accountNumber: v.pipe(v.string(), v.minLength(4)),
  accountName: v.optional(v.union([v.string(), v.null_()])),
  isDefault: v.optional(v.boolean())
});

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
    const parsed = v.safeParse(InsertBankAccountSchema, data);
    if (!parsed.success) {
      const firstIssue = parsed.issues[0];
      throw new Error(`Bank account validation failed: ${firstIssue?.message ?? 'Invalid data'}`);
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
