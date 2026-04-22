import { injectable, inject } from 'tsyringe';
import { eq, and, ne, inArray, count, isNull, or, type SQL } from '@repo/db';
import { debts, type Debt as DebtEntity, type NewDebt as CreateDebtData, type DbClient } from '@repo/db';
import type { PaginatedResult } from '@repo/types';
import type { DebtRepositoryInterface, DebtFilterOptions } from '../Contracts/DebtRepositoryInterface';
import { SoftDeletePlugin } from '../Plugins/SoftDeletePlugin';
import { PaginationPlugin } from '../Plugins/PaginationPlugin';

@injectable()
export class DebtRepository implements DebtRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async findById(id: string, includeDeleted = false): Promise<DebtEntity | null> {
    const conditions: SQL[] = SoftDeletePlugin.applyCheck([eq(debts.id, id)], debts.deletedAt, includeDeleted);
    const result = await this.db.select().from(debts).where(and(...conditions)).get();
    return (result as DebtEntity) || null;
  }

  async findByIds(ids: string[], includeDeleted = false): Promise<DebtEntity[]> {
    if (ids.length === 0) return [];
    const conditions: SQL[] = SoftDeletePlugin.applyCheck([inArray(debts.id, ids)], debts.deletedAt, includeDeleted);
  
    return (await this.db
      .select()
      .from(debts)
      .where(and(...conditions))
      .all()) as DebtEntity[];
  }

  async findMany(options: DebtFilterOptions): Promise<PaginatedResult<DebtEntity>> {
    const { limit = 20, offset = 0, status, debtorId, creditorId, uploadedById, involvedUserId, includeDeleted = false } = options;
    
    const conditions: SQL[] = SoftDeletePlugin.applyCheck([], debts.deletedAt, includeDeleted);
    if (status && status !== 'all') conditions.push(eq(debts.status, status as any));
    if (debtorId) conditions.push(eq(debts.debtorId, debtorId));
    if (creditorId) conditions.push(eq(debts.creditorId, creditorId));
    if (uploadedById) conditions.push(eq(debts.uploadedById, uploadedById));
    if (involvedUserId) {
      conditions.push(or(eq(debts.debtorId, involvedUserId), eq(debts.creditorId, involvedUserId)) as SQL);
    }
  
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const countPromise = this.db.select({ count: count() }).from(debts).where(where).get();
    const dataPromise = this.db.select().from(debts).where(where).limit(limit).offset(offset).all();

    const [countRes, dataRes] = await Promise.all([countPromise, dataPromise]);

    return PaginationPlugin.toPaginatedResult(dataRes as DebtEntity[], countRes?.count ?? 0, limit, offset);
  }

  async count(options: Omit<DebtFilterOptions, 'limit' | 'offset'>): Promise<number> {
    const { status, debtorId, creditorId, uploadedById, involvedUserId, includeDeleted = false } = options;
    
    const conditions: SQL[] = SoftDeletePlugin.applyCheck([], debts.deletedAt, includeDeleted);
    if (status && status !== 'all') conditions.push(eq(debts.status, status as any));
    if (debtorId) conditions.push(eq(debts.debtorId, debtorId));
    if (creditorId) conditions.push(eq(debts.creditorId, creditorId));
    if (uploadedById) conditions.push(eq(debts.uploadedById, uploadedById));
    if (involvedUserId) {
      conditions.push(or(eq(debts.debtorId, involvedUserId), eq(debts.creditorId, involvedUserId)) as SQL);
    }
  
    const where = conditions.length > 0 ? and(...conditions) : undefined;
  
    const result = await this.db.select({ count: count() }).from(debts).where(where).get();
    return (result as any)?.count ?? 0;
  }

  async create(data: CreateDebtData): Promise<DebtEntity> {
    const [created] = await this.db.insert(debts).values(data).returning();
    return created as DebtEntity;
  }

  async update(id: string, data: Partial<DebtEntity> & { updatedAt: Date }): Promise<DebtEntity | null> {
    const [updated] = await this.db
      .update(debts)
      .set(data)
      .where(eq(debts.id, id))
      .returning();
    return (updated as DebtEntity) || null;
  }

  async softDelete(id: string, deletedAt: Date): Promise<boolean> {
    const [updated] = await this.db
      .update(debts)
      .set({ deletedAt, updatedAt: new Date() })
      .where(eq(debts.id, id))
      .returning();
    return !!updated;
  }

  async findPotentialDuplicates(
    debtorPhone: string,
    creditorPhone: string,
    amount: number,
    amountTolerance: number,
    daysBack: number
  ): Promise<{ id: string; amount: number; description: string | null; createdAt: Date }[]> {
    // Simplified implementation - in real app would use date ranges
    const results = await this.db
      .select({
        id: debts.id,
        amount: debts.amount,
        description: debts.description,
        createdAt: debts.createdAt
      })
      .from(debts)
      .where(
        and(
          eq(debts.debtorPhone, debtorPhone),
          eq(debts.creditorPhone, creditorPhone),
          isNull(debts.deletedAt)
        )
      )
      .all();
    
    return results
      .filter(r => Math.abs(r.amount - amount) <= amountTolerance)
      .map(r => ({
        id: r.id,
        amount: r.amount,
        description: r.description,
        createdAt: r.createdAt
      }));
  }

  async getRecentContacts(userId: string, limit: number): Promise<string[]> {
    // Simplified: get phones from recent debts
    const results = await this.db
      .select({ 
        debtorPhone: debts.debtorPhone, 
        creditorPhone: debts.creditorPhone 
      })
      .from(debts)
      .where(or(eq(debts.debtorId, userId), eq(debts.creditorId, userId)))
      .limit(limit)
      .all();
    
    const phones = new Set<string>();
    results.forEach((r: { debtorPhone: string; creditorPhone: string }) => {
      phones.add(r.debtorPhone);
      phones.add(r.creditorPhone);
    });
    return Array.from(phones);
  }

  async countActiveDebtsForPhone(phone: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(debts)
      .where(
        SoftDeletePlugin.filter(
          and(
            or(eq(debts.debtorPhone, phone), eq(debts.creditorPhone, phone)),
            ne(debts.status, 'paid'),
            ne(debts.status, 'cancelled')
          ),
          debts.deletedAt
        )
      )
      .get();
    return result?.count ?? 0;
  }

  async countUnconfirmedByCreditor(creditorId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(debts)
      .where(and(eq(debts.creditorId, creditorId), eq(debts.needsConfirmation, true)))
      .get();
    return result?.count ?? 0;
  }

  async batchSoftDelete(ids: string[], deletedAt: Date): Promise<{ deleted: string[]; notFound: string[] }> {
    const updated = await this.db
      .update(debts)
      .set({ deletedAt, updatedAt: new Date() })
      .where(inArray(debts.id, ids))
      .returning({ id: debts.id });
    
    const deletedIds = updated.map(r => r.id);
    const notFound = ids.filter(id => !deletedIds.includes(id));
    
    return { deleted: deletedIds, notFound };
  }

  async softDeleteByUploader(uploadedById: string, deletedAt: Date): Promise<number> {
    const result = await this.db
      .update(debts)
      .set({ deletedAt, updatedAt: new Date() })
      .where(and(eq(debts.uploadedById, uploadedById), isNull(debts.deletedAt)))
      .returning();
    return result.length;
  }

  async linkDebtsToUser(userId: string, phoneNumber: string): Promise<void> {
    await this.db
      .update(debts)
      .set({ debtorId: userId, updatedAt: new Date() })
      .where(and(eq(debts.debtorPhone, phoneNumber), isNull(debts.debtorId)));

    await this.db
      .update(debts)
      .set({ creditorId: userId, updatedAt: new Date() })
      .where(and(eq(debts.creditorPhone, phoneNumber), isNull(debts.creditorId)));
  }

  async countByUserId(userId: string): Promise<{ total: number; pending: number; completed: number }> {
    const totalResult = await this.db
      .select({ count: count() })
      .from(debts)
      .where(
        SoftDeletePlugin.filter(
          or(eq(debts.debtorId, userId), eq(debts.creditorId, userId)),
          debts.deletedAt
        )
      )
      .get();
    
    // Simplified implementation for other counts
    return {
      total: totalResult?.count ?? 0,
      pending: 0,
      completed: 0
    };
  }
}

