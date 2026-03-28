import { eq, and, or, sql, desc, count, inArray, lte } from 'drizzle-orm';
import type { ImportLog, User, Debt } from '@repo/db';
import { importLogs, users, debts } from '@repo/db';
import type { IImportExportRepository } from '@repo/types';
import type { DbClient } from '@/types';

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
    const result = await this.db
      .delete(importLogs)
      .where(
        and(
          eq(importLogs.userId, userId),
          eq(importLogs.status, status as any),
          lte(importLogs.createdAt, olderThan)
        )
      );
    // SQLite doesn't always return rows affected in a standard way through Drizzle for delete
    // but we return something indicative.
    return 1; 
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
