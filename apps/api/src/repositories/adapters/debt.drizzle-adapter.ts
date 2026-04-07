/**
 * Debt Repository Implementation (Adapter)
 * 
 * Drizzle ORM implementation of IDebtRepository.
 * This is the Adapter in Hexagonal Architecture - it adapts the port to the concrete Drizzle ORM.
 */
import {
  debts,
  eq,
  ne,
  gte,
  desc,
  and,
  or,
  count,
  isNull,
  inArray,
  sql
} from '@repo/db';
import { configs } from '@/configs';
import type { DebtStatus } from '@repo/types';
import { DEBT_STATUS } from '@repo/config';
import type { DbClient } from '@/types';
import type { PaginatedResult } from '@repo/types';
import type {
  IDebtRepository,
  DebtEntity,
  DebtFilterOptions,
  CreateDebtData,
  UpdateDebtData
} from '@/types/repositories';

/**
 * Drizzle implementation of DebtRepository
 */
export class DebtDrizzleAdapter implements IDebtRepository {
  constructor(private db: DbClient) { }

  private buildWhere(options: Omit<DebtFilterOptions, 'limit' | 'offset'>) {
    const { status, involvedUserId, includeDeleted } = options;
    let where: ReturnType<typeof and> | ReturnType<typeof or> | undefined;

    if (involvedUserId) {
      where = or(eq(debts.debtorId, involvedUserId), eq(debts.creditorId, involvedUserId));
    }

    if (options.debtorId) {
      const debtorCond = eq(debts.debtorId, options.debtorId);
      where = where ? and(where, debtorCond) : debtorCond;
    }

    if (options.creditorId) {
      const creditorCond = eq(debts.creditorId, options.creditorId);
      where = where ? and(where, creditorCond) : creditorCond;
    }

    if (options.uploadedById) {
      const uploadedCond = eq(debts.uploadedById, options.uploadedById);
      where = where ? and(where, uploadedCond) : uploadedCond;
    }

    if (status && status !== 'all') {
      const statusCond = eq(debts.status, status);
      where = where ? and(where, statusCond) : statusCond;
    }

    if (!includeDeleted) {
      where = where ? and(where, isNull(debts.deletedAt)) : isNull(debts.deletedAt);
    }

    return where;
  }

  /**
   * Map Drizzle Debt to domain DebtEntity
   */
  private toEntity(debt: typeof debts.$inferSelect): DebtEntity {
    return {
      ...debt,
      status: debt.status as DebtStatus
    } as DebtEntity;
  }

  async findById(id: string, includeDeleted = false): Promise<DebtEntity | null> {
    const where = includeDeleted
      ? eq(debts.id, id)
      : and(eq(debts.id, id), isNull(debts.deletedAt));

    const debt = await this.db.query.debts.findFirst({ where });
    return debt ? this.toEntity(debt) : null;
  }

  async findByIds(ids: string[], includeDeleted = false): Promise<DebtEntity[]> {
    if (ids.length === 0) return [];

    const where = includeDeleted
      ? inArray(debts.id, ids)
      : and(inArray(debts.id, ids), isNull(debts.deletedAt));

    const rows = await this.db.select().from(debts).where(where).all();
    return rows.map((row) => this.toEntity(row));
  }

  async findMany(options: DebtFilterOptions): Promise<PaginatedResult<DebtEntity>> {
    const limit = Math.min(
      Math.max(options.limit ?? configs.PAGINATION.DEFAULT_LIMIT, 1),
      configs.PAGINATION.MAX_LIMIT
    );
    const offset = Math.min(
      Math.max(options.offset ?? 0, 0),
      configs.PAGINATION.MAX_OFFSET ?? 50000
    );
    const where = this.buildWhere(options);

    // Parallelize count and data queries
    const countQuery = where
      ? this.db.select({ count: count() }).from(debts).where(where).get()
      : this.db.select({ count: count() }).from(debts).get();

    let dataQuery = this.db.select().from(debts);
    if (where) dataQuery = dataQuery.where(where) as typeof dataQuery;
    const fetchQuery = dataQuery
      .orderBy(desc(debts.createdAt), desc(debts.id))
      .limit(limit)
      .offset(offset)
      .all();

    const [countRes, dataRes] = await Promise.allSettled([countQuery, fetchQuery]);

    if (countRes.status === 'rejected') {
      throw new Error(`Database count query failed: ${String(countRes.reason)}`);
    }
    if (dataRes.status === 'rejected') {
      throw new Error(`Database fetch query failed: ${String(dataRes.reason)}`);
    }

    const total = countRes.value?.count ?? 0;
    const data = dataRes.value;

    return {
      success: true,
      data: data.map((d: typeof data[0]) => this.toEntity(d)),
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total
      }
    };
  }

  async count(options: Omit<DebtFilterOptions, 'limit' | 'offset'>): Promise<number> {
    const where = this.buildWhere(options);

    const countResult = where
      ? await this.db.select({ count: count() }).from(debts).where(where).get()
      : await this.db.select({ count: count() }).from(debts).get();

    return countResult?.count ?? 0;
  }

  async create(data: CreateDebtData): Promise<DebtEntity> {
    const result = await this.db.insert(debts).values(data).returning();
    return this.toEntity(result[0]);
  }

  async update(id: string, data: UpdateDebtData): Promise<DebtEntity | null> {
    const result = await this.db.update(debts).set(data).where(eq(debts.id, id)).returning();
    return result.length > 0 ? this.toEntity(result[0]) : null;
  }

  async countByUserId(userId: string): Promise<{ total: number; pending: number; completed: number }> {
    const stats = await this.db
      .select({
        status: debts.status,
        count: count()
      })
      .from(debts)
      .where(or(eq(debts.creditorId, userId), eq(debts.debtorId, userId)))
      .groupBy(debts.status)
      .all();

    const result = { total: 0, pending: 0, completed: 0 };
    for (const s of stats) {
      result.total += s.count;
      if (s.status === 'pending') result.pending += s.count;
      if (s.status === 'paid') result.completed += s.count;
    }
    return result;
  }

  async softDelete(id: string, deletedAt: Date): Promise<boolean> {
    const result = await this.db
      .update(debts)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(debts.id, id), isNull(debts.deletedAt)))
      .returning();
    return result.length > 0;
  }

  async findPotentialDuplicates(
    debtorPhone: string,
    creditorPhone: string,
    amount: number,
    amountTolerance: number,
    daysBack: number
  ): Promise<{ id: string; amount: number; description: string | null; createdAt: Date }[]> {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const amountRange = amount * amountTolerance;

    const duplicates = await this.db
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
          gte(debts.amount, amount - amountRange),
          gte(debts.createdAt, cutoffDate),
          ne(debts.status, DEBT_STATUS.CANCELLED as DebtStatus),
          isNull(debts.deletedAt)
        )
      )
      .all();

    return duplicates.filter((d) => d.amount <= amount + amountRange);
  }

  async batchSoftDelete(ids: string[], deletedAt: Date): Promise<{ deleted: string[]; notFound: string[] }> {
    if (ids.length === 0) {
      return { deleted: [], notFound: [] };
    }

    const existingRows = await this.db
      .select({ id: debts.id })
      .from(debts)
      .where(and(inArray(debts.id, ids), isNull(debts.deletedAt)))
      .all();

    const deleted = existingRows.map((row) => row.id);
    if (deleted.length > 0) {
      await this.db
        .update(debts)
        .set({ deletedAt, updatedAt: deletedAt })
        .where(and(inArray(debts.id, deleted), isNull(debts.deletedAt)));
    }

    const deletedSet = new Set(deleted);
    const notFound = ids.filter((id) => !deletedSet.has(id));
    return { deleted, notFound };
  }

  async softDeleteByUploader(uploadedById: string, deletedAt: Date): Promise<number> {
    const result = await this.db
      .update(debts)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(debts.uploadedById, uploadedById), isNull(debts.deletedAt)))
      .returning({ id: debts.id });

    return result.length;
  }

  async getRecentContacts(userId: string, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({
        phone: sql<string>`CASE WHEN ${debts.debtorId} = ${userId} THEN ${debts.creditorPhone} ELSE ${debts.debtorPhone} END`,
        lastCreatedAt: sql<number>`MAX(${debts.createdAt})`
      })
      .from(debts)
      .where(and(or(eq(debts.debtorId, userId), eq(debts.creditorId, userId)), isNull(debts.deletedAt)))
      .groupBy(sql`CASE WHEN ${debts.debtorId} = ${userId} THEN ${debts.creditorPhone} ELSE ${debts.debtorPhone} END`)
      .orderBy(sql`lastCreatedAt DESC`)
      .limit(limit)
      .all();

    return rows.map((row) => row.phone).filter(Boolean);
  }

  async countActiveDebtsForPhone(phone: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(debts)
      .where(
        and(
          or(eq(debts.debtorPhone, phone), eq(debts.creditorPhone, phone)),
          and(ne(debts.status, DEBT_STATUS.PAID as DebtStatus), ne(debts.status, DEBT_STATUS.CANCELLED as DebtStatus)),
          isNull(debts.deletedAt)
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
}
