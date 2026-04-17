import { injectable } from 'tsyringe';
import { db, users, debts, importLogs, eq, inArray, sql, desc } from '@repo/db';
import type { ImportLog, User, Debt } from '@repo/db';
import type { PaginatedResult } from '@repo/types';
import type { ImportRepositoryInterface } from '../Contracts/ImportRepositoryInterface';

@injectable()
export class ImportRepository implements ImportRepositoryInterface {
  async createLog(data: any): Promise<void> {
    await db.insert(importLogs).values(data);
  }

  async updateLog(id: string, data: Partial<ImportLog>): Promise<void> {
    await db.update(importLogs).set(data).where(eq(importLogs.id, id));
  }

  async getLogById(id: string, userId: string): Promise<ImportLog | null> {
    const result = await db.query.importLogs.findFirst({
      where: (logs, { and, eq }) => and(eq(logs.id, id), eq(logs.userId, userId))
    });
    return result || null;
  }

  async getLogsByIds(ids: string[], userId: string): Promise<ImportLog[]> {
    if (ids.length === 0) return [];
    return db.query.importLogs.findMany({
      where: (logs, { and, eq, inArray }) => and(
        inArray(logs.id, ids),
        eq(logs.userId, userId)
      )
    });
  }

  async getLogsPaginated(userId: string, limit: number, offset: number): Promise<PaginatedResult<ImportLog>> {
    const where = eq(importLogs.userId, userId);
    
    const [items, countResult] = await Promise.all([
      db.query.importLogs.findMany({
        where,
        limit,
        offset,
        orderBy: [desc(importLogs.createdAt)]
      }),
      db.select({ count: sql<number>`count(*)` }).from(importLogs).where(where)
    ]);

    const total = Number(countResult[0]?.count || 0);

    return {
      items,
      pagination: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async deleteLogsByStatus(userId: string, status: string, olderThan: Date): Promise<number> {
    const result = await db.delete(importLogs).where(
      sql`${importLogs.userId} = ${userId} AND ${importLogs.status} = ${status} AND ${importLogs.createdAt} < ${olderThan}`
    );
    // Drizzle delete result depends on driver, usually it's just void or rows affected
    return 0; // Placeholder as actual count might not be available easily across drivers
  }

  async findUsersByIdentifiers(identifiers: string[]): Promise<Pick<User, 'id' | 'email' | 'phoneNumber'>[]> {
    if (identifiers.length === 0) return [];
    return db.select({
      id: users.id,
      email: users.email,
      phoneNumber: users.phoneNumber
    })
    .from(users)
    .where(
      sql`${users.email} IN ${identifiers} OR ${users.phoneNumber} IN ${identifiers}`
    );
  }

  async createDebtsBatch(debtsToCreate: any[]): Promise<void> {
    if (debtsToCreate.length === 0) return;
    await db.insert(debts).values(debtsToCreate);
  }
}
