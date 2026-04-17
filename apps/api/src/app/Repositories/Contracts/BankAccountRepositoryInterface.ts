import type { BankAccount } from '@repo/db';

export interface BankAccountRepositoryInterface {
  findById(id: string): Promise<BankAccount | null>;
  findByUserId(userId: string): Promise<BankAccount[]>;
  findPrimaryByUserId(userId: string): Promise<BankAccount | null>;
  create(data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<BankAccount>;
  update(id: string, data: Partial<BankAccount>): Promise<BankAccount | null>;
  delete(id: string): Promise<void>;
  setPrimary(id: string, userId: string): Promise<void>;
}
