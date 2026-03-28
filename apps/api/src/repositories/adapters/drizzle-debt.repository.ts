/**
 * Debt Repository Implementation (Adapter)
 * 
 * Drizzle ORM implementation of IDebtRepository.
 * This is the Adapter in Hexagonal Architecture - it adapts the port to the concrete Drizzle ORM.
 */
import {
  debts,
  users,
  eq,
  ne,
  gte,
  desc,
  and,
  or,
  count,
  isNull
} from '@repo/db';
import { configs } from '@/configs';
import type { DebtStatus } from '@repo/types';
import type { DbClient } from '@/types';
import type { PaginatedResult } from '@repo/types';
import type {
  IDebtRepository,
  DebtEntity,
  DebtFilterOptions,
  CreateDebtData,
  UpdateDebtData
} from '../debt.repository.interface';

/**
 * Drizzle implementation of DebtRepository
 */
export class DrizzleDebtRepository implements IDebtRepository {
  constructor(private db: DbClient) {}

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

  async findMany(options: DebtFilterOptions): Promise<PaginatedResult<DebtEntity>> {
    const { 
      limit = configs.PAGINATION.DEFAULT_LIMIT, 
      offset = 0, 
      status, 
      involvedUserId, 
      includeDeleted 
    } = options;

    // Build where clause
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

    // Get count
    const countResult = where
      ? await this.db.select({ count: count() }).from(debts).where(where).get()
      : await this.db.select({ count: count() }).from(debts).get();
    const total = countResult?.count ?? 0;

    // Get data
    let query = this.db.select().from(debts);
    if (where) query = query.where(where) as typeof query;
    const data = await query
      .orderBy(desc(debts.createdAt), desc(debts.id))
      .limit(limit)
      .offset(offset)
      .all();

    return {
      success: true,
      data: data.map((d: typeof data[0]) => this.toEntity(d)),
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async count(options: Omit<DebtFilterOptions, 'limit' | 'offset'>): Promise<number> {
    // Reuse findMany logic but only return count
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

  async linkToUser(userId: string, phoneNumber: string): Promise<void> {
    const now = new Date();
    // Link debtor
    await this.db
      .update(debts)
      .set({ debtorId: userId, updatedAt: now })
      .where(and(eq(debts.debtorPhone, phoneNumber), isNull(debts.debtorId)));

    // Link creditor
    await this.db
      .update(debts)
      .set({ creditorId: userId, updatedAt: now })
      .where(and(eq(debts.creditorPhone, phoneNumber), isNull(debts.creditorId)));
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
    const deleted: string[] = [];
    const notFound: string[] = [];

    for (const id of ids) {
      const result = await this.db
        .update(debts)
        .set({ deletedAt, updatedAt: deletedAt })
        .where(and(eq(debts.id, id), isNull(debts.deletedAt)))
        .returning({ id: debts.id });

      if (result.length > 0) {
        deleted.push(id);
      } else {
        notFound.push(id);
      }
    }

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
    // Get all debts involving this user
    const userDebts = await this.db
      .select({
        debtorPhone: debts.debtorPhone,
        creditorPhone: debts.creditorPhone,
        createdAt: debts.createdAt
      })
      .from(debts)
      .where(or(eq(debts.debtorId, userId), eq(debts.creditorId, userId)))
      .orderBy(debts.createdAt)
      .all();

    // Get user's phone number
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { phoneNumber: true }
    });
    const myPhone = user?.phoneNumber;

    // Extract unique counterparty phones
    const seenPhones = new Set<string>();
    const contacts: string[] = [];

    for (let i = userDebts.length - 1; i >= 0 && contacts.length < limit; i--) {
      const d = userDebts[i];
      const counterpartyPhone = d.debtorPhone !== myPhone ? d.debtorPhone : d.creditorPhone;

      if (counterpartyPhone && !seenPhones.has(counterpartyPhone)) {
        seenPhones.add(counterpartyPhone);
        contacts.push(counterpartyPhone);
      }
    }

    return contacts;
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
