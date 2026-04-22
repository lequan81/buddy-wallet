import { injectable, inject } from 'tsyringe';
import { bankAccounts, eq, type DbClient, type BankAccount } from '@repo/db';
import type { BankAccountRepositoryInterface } from '../Contracts/BankAccountRepositoryInterface';
import { randomUUIDv7 } from 'bun';

@injectable()
export class BankAccountRepository implements BankAccountRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async findById(id: string): Promise<BankAccount | null> {
    const result = await this.db.query.bankAccounts.findFirst({
      where: (acc: any, { eq }: any) => eq(acc.id, id)
    });
    return (result as BankAccount) || null;
  }

  async findByUserId(userId: string): Promise<BankAccount[]> {
    return (await this.db.query.bankAccounts.findMany({
      where: (acc: any, { eq }: any) => eq(acc.userId, userId)
    })) as BankAccount[];
  }

  async findPrimaryByUserId(userId: string): Promise<BankAccount | null> {
    const result = await this.db.query.bankAccounts.findFirst({
      where: (acc: any, { and, eq }: any) => and(eq(acc.userId, userId), eq(acc.isDefault, true))
    });
    return (result as BankAccount) || null;
  }

  async create(data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<BankAccount> {
    const id = randomUUIDv7();
    const [result] = await this.db.insert(bankAccounts).values({
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result as BankAccount;
  }

  async update(id: string, data: Partial<BankAccount>): Promise<BankAccount | null> {
    const [result] = await this.db.update(bankAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bankAccounts.id, id))
      .returning();
    return (result as BankAccount) || null;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(bankAccounts).where(eq(bankAccounts.id, id));
  }

  async setPrimary(id: string, userId: string): Promise<void> {
    await this.db.transaction(async (tx: any) => {
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
}
