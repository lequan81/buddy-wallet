import { eq, and, ne, inArray, count, isNull, or, gte, lte, asc, desc, debts } from '@repo/db';
import type { SQL, Debt, NewDebt, DbClient, DebtStatus } from '@repo/db';
import type { PaginatedResult } from '@repo/types';
import { db } from '@/providers/database';
import * as v from 'valibot';

export interface DebtFindManyOptions {
  limit?: number;
  offset?: number;
  status?: DebtStatus | 'all';
  debtorId?: string;
  creditorId?: string;
  uploadedById?: string;
  involvedUserId?: string;
  includeDeleted?: boolean;
  sortBy?: 'createdAt' | 'amount' | 'status' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export type DebtCountOptions = Omit<DebtFindManyOptions, 'limit' | 'offset'>;

// ── Valibot Validation Schemas ────────────────────────────────
const InsertDebtSchema = v.object({
  debtorPhone: v.pipe(v.string(), v.minLength(1)),
  creditorPhone: v.pipe(v.string(), v.minLength(1)),
  debtorId: v.optional(v.union([v.string(), v.null_()])),
  creditorId: v.optional(v.union([v.string(), v.null_()])),
  uploadedById: v.pipe(v.string(), v.minLength(1)),
  amount: v.pipe(v.number(), v.minValue(1)),
  currency: v.pipe(v.string(), v.minLength(3), v.maxLength(3)),
  description: v.optional(v.union([v.string(), v.null_()])),
  status: v.optional(v.picklist(['pending', 'confirmed', 'paid', 'disputed', 'cancelled'])),
  expiresAt: v.optional(v.union([v.date(), v.null_()])),
  needsConfirmation: v.optional(v.boolean())
});

/**
 * Debt Repository
 * Data access layer for debt operations
 * No DI container - uses direct db instance
 */
export class DebtRepository {
  constructor(private readonly database: DbClient = db) {}

  async findById(id: string, includeDeleted = false): Promise<Debt | null> {
    const conditions: SQL[] = [eq(debts.id, id)];
    if (!includeDeleted) conditions.push(isNull(debts.deletedAt));
    
    const result = await this.database.select().from(debts).where(and(...conditions)).get();
    return result || null;
  }

  async findByIds(ids: string[], includeDeleted = false): Promise<Debt[]> {
    if (ids.length === 0) return [];
    const conditions: SQL[] = [inArray(debts.id, ids)];
    if (!includeDeleted) conditions.push(isNull(debts.deletedAt));
  
    return await this.database
      .select()
      .from(debts)
      .where(and(...conditions))
      .all();
  }

  async findMany(options: DebtFindManyOptions): Promise<PaginatedResult<Debt>> {
    const { limit = 20, offset = 0, status, debtorId, creditorId, uploadedById, involvedUserId, includeDeleted = false, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    
    const conditions: SQL[] = [];
    if (!includeDeleted) conditions.push(isNull(debts.deletedAt));
    if (status && status !== 'all') conditions.push(eq(debts.status, status as DebtStatus));
    if (debtorId) conditions.push(eq(debts.debtorId, debtorId));
    if (creditorId) conditions.push(eq(debts.creditorId, creditorId));
    if (uploadedById) conditions.push(eq(debts.uploadedById, uploadedById));
    if (involvedUserId) {
      conditions.push(or(eq(debts.debtorId, involvedUserId), eq(debts.creditorId, involvedUserId)) as SQL);
    }
  
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumn = debts[sortBy] || debts.createdAt;
    const orderFn = sortOrder === 'asc' ? asc : desc;

    const countPromise = this.database.select({ count: count() }).from(debts).where(where).get();
    const dataPromise = this.database.select().from(debts).where(where).orderBy(orderFn(sortColumn)).limit(limit).offset(offset).all();

    const [countRes, dataRes] = await Promise.all([countPromise, dataPromise]);

    return {
      items: dataRes,
      pagination: {
        total: countRes?.count ?? 0,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1
      }
    };
  }

  async count(options: DebtCountOptions): Promise<number> {
    const { status, debtorId, creditorId, uploadedById, involvedUserId, includeDeleted = false } = options;
    
    const conditions: SQL[] = [];
    if (!includeDeleted) conditions.push(isNull(debts.deletedAt));
    if (status && status !== 'all') conditions.push(eq(debts.status, status as DebtStatus));
    if (debtorId) conditions.push(eq(debts.debtorId, debtorId));
    if (creditorId) conditions.push(eq(debts.creditorId, creditorId));
    if (uploadedById) conditions.push(eq(debts.uploadedById, uploadedById));
    if (involvedUserId) {
      conditions.push(or(eq(debts.debtorId, involvedUserId), eq(debts.creditorId, involvedUserId)) as SQL);
    }
  
    const where = conditions.length > 0 ? and(...conditions) : undefined;
  
    const result = await this.database.select({ count: count() }).from(debts).where(where).get();
    return result?.count ?? 0;
  }

  async create(data: Omit<NewDebt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Debt> {
    const result = v.safeParse(InsertDebtSchema, data);
    if (!result.success) {
      const firstIssue = result.issues[0];
      throw new Error(`Debt validation failed: ${firstIssue?.message ?? 'Invalid data'}`);
    }
    const now = new Date();
    const [created] = await this.database.insert(debts).values({
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    }).returning();
    return created;
  }

  async update(id: string, data: Partial<Debt> & { updatedAt: Date }): Promise<Debt | null> {
    const [updated] = await this.database
      .update(debts)
      .set(data)
      .where(eq(debts.id, id))
      .returning();
    return updated || null;
  }

  async softDelete(id: string, deletedAt: Date): Promise<boolean> {
    const [updated] = await this.database
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
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);
    
    const minAmount = amount - amountTolerance;
    const maxAmount = amount + amountTolerance;

    const results = await this.database
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
          isNull(debts.deletedAt),
          gte(debts.createdAt, fromDate),
          gte(debts.amount, minAmount),
          lte(debts.amount, maxAmount)
        )
      )
      .all();
    
    return results.map(r => ({
      id: r.id,
      amount: r.amount,
      description: r.description,
      createdAt: r.createdAt
    }));
  }

  async getRecentContacts(userId: string, limit: number): Promise<string[]> {
    const results = await this.database
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
    const result = await this.database
      .select({ count: count() })
      .from(debts)
      .where(
        and(
          or(eq(debts.debtorPhone, phone), eq(debts.creditorPhone, phone)),
          ne(debts.status, 'paid'),
          ne(debts.status, 'cancelled'),
          isNull(debts.deletedAt)
        )
      )
      .get();
    return result?.count ?? 0;
  }

  async countUnconfirmedByCreditor(creditorId: string): Promise<number> {
    const result = await this.database
      .select({ count: count() })
      .from(debts)
      .where(and(eq(debts.creditorId, creditorId), eq(debts.needsConfirmation, true)))
      .get();
    return result?.count ?? 0;
  }

  async batchSoftDelete(ids: string[], deletedAt: Date): Promise<{ deleted: string[]; notFound: string[] }> {
    const updated = await this.database
      .update(debts)
      .set({ deletedAt, updatedAt: new Date() })
      .where(inArray(debts.id, ids))
      .returning({ id: debts.id });
    
    const deletedIds = updated.map(r => r.id);
    const notFound = ids.filter(id => !deletedIds.includes(id));
    
    return { deleted: deletedIds, notFound };
  }

  async softDeleteByUploader(uploadedById: string, deletedAt: Date): Promise<number> {
    const result = await this.database
      .update(debts)
      .set({ deletedAt, updatedAt: new Date() })
      .where(and(eq(debts.uploadedById, uploadedById), isNull(debts.deletedAt)))
      .returning();
    return result.length;
  }

  async linkDebtsToUser(userId: string, phoneNumber: string): Promise<void> {
    await this.database
      .update(debts)
      .set({ debtorId: userId, updatedAt: new Date() })
      .where(and(eq(debts.debtorPhone, phoneNumber), isNull(debts.debtorId)));

    await this.database
      .update(debts)
      .set({ creditorId: userId, updatedAt: new Date() })
      .where(and(eq(debts.creditorPhone, phoneNumber), isNull(debts.creditorId)));
  }

  async existsRelationship(userAId: string, userBId: string): Promise<boolean> {
    const result = await this.database
      .select({ id: debts.id })
      .from(debts)
      .where(
        and(
          isNull(debts.deletedAt),
          or(
            and(eq(debts.debtorId, userAId), eq(debts.creditorId, userBId)),
            and(eq(debts.debtorId, userBId), eq(debts.creditorId, userAId))
          )
        )
      )
      .limit(1)
      .get();

    return Boolean(result);
  }

  async countByUserId(userId: string): Promise<{ total: number; pending: number; completed: number }> {
    const results = await this.database
      .select({ status: debts.status, count: count() })
      .from(debts)
      .where(
        and(
          or(eq(debts.debtorId, userId), eq(debts.creditorId, userId)),
          isNull(debts.deletedAt)
        )
      )
      .groupBy(debts.status)
      .all();
    
    let total = 0;
    let pending = 0;
    let completed = 0;

    for (const r of results) {
      const c = Number(r.count);
      total += c;
      if (r.status === 'pending') pending += c;
      if (r.status === 'paid' || r.status === 'confirmed') completed += c;
    }

    return { total, pending, completed };
  }
}
