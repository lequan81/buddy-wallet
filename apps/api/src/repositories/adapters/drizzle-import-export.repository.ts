import {
  eq,
  and,
  or,
  desc,
  count,
  inArray,
  lte,
  importLogs,
  users,
  debts,
  type User,
  type Debt
} from '@repo/db';
import type { IImportExportRepository } from '@repo/types';
import type { DbClient } from '@/types';

type ImportLog = typeof importLogs.$inferSelect;

export class DrizzleImportExportRepository implements IImportExportRepository {
  constructor(private readonly db: DbClient) {}

  async createLog(data: Omit<ImportLog, 'createdAt' | 'deletedAt'>): Promise<void> {
    await this.db.insert(importLogs).values({
      ...data,
      createdAt: new Date()
    });
  }

  async updateLog(id: string, data: Partial<ImportLog>): Promise<void> {
    await this.db.update(importLogs).set(data).where(eq(importLogs.id, id));
  }

  async getLogById(id: string, userId: string): Promise<ImportLog | null> {
    return (
      (await this.db
        .select()
        .from(importLogs)
        .where(and(eq(importLogs.id, id), eq(importLogs.userId, userId)))
        .get()) || null
    );
  }

  async getLogsByIds(ids: string[], userId: string): Promise<ImportLog[]> {
    if (ids.length === 0) return [];

    return this.db
      .select()
      .from(importLogs)
      .where(and(eq(importLogs.userId, userId), inArray(importLogs.id, ids)))
      .all();
  }

  async getLogsPaginated(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ logs: ImportLog[]; total: number }> {
    const [rows, totalResult] = await Promise.all([
      this.db
        .select()
        .from(importLogs)
        .where(eq(importLogs.userId, userId))
        .orderBy(desc(importLogs.createdAt), desc(importLogs.id))
        .limit(limit)
        .offset(offset)
        .all(),
      this.db
        .select({ count: count() })
        .from(importLogs)
        .where(eq(importLogs.userId, userId))
        .get()
    ]);

    return {
      logs: rows,
      total: totalResult?.count ?? 0
    };
  }

  async deleteLogsByStatus(userId: string, status: string, olderThan: Date): Promise<number> {
    const whereClause = and(
      eq(importLogs.userId, userId),
      eq(importLogs.status, status as typeof importLogs.$inferSelect.status),
      lte(importLogs.createdAt, olderThan)
    );

    const rows = await this.db
      .select({ id: importLogs.id })
      .from(importLogs)
      .where(whereClause)
      .all();

    if (rows.length === 0) return 0;

    await this.db
      .delete(importLogs)
      .where(whereClause);

    return rows.length;
  }

  async findUsersByIdentifiers(identifiers: string[]): Promise<Pick<User, 'id' | 'email' | 'phoneNumber'>[]> {
    if (identifiers.length === 0) return [];
    
    return this.db
      .select({
        id: users.id,
        email: users.email,
        phoneNumber: users.phoneNumber
      })
      .from(users)
      .where(or(inArray(users.email, identifiers), inArray(users.phoneNumber, identifiers)))
      .all();
  }

  async createDebtsBatch(debtsToCreate: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    if (debtsToCreate.length === 0) return;
    
    // Chunking is handled by Drizzle or can be done manually if needed.
    // Drizzle sqlite-proxy/bun-sqlite handles large inserts.
    await this.db.insert(debts).values(debtsToCreate as any);
  }
}
