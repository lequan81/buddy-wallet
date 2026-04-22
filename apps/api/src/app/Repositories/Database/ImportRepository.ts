import { injectable, inject } from 'tsyringe';
import { users, debts, importLogs, eq, and, sql, type ImportLog, type User, type DbClient } from '@repo/db';
import type { PaginatedResult } from '@repo/types';
import type { ImportRepositoryInterface } from '../Contracts/ImportRepositoryInterface';
import { PaginationPlugin } from '../Plugins/PaginationPlugin';

@injectable()
export class ImportRepository implements ImportRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async createLog(data: {
    id: string;
    userId: string;
    fileName: string;
    fileSize: number;
    status: 'pending' | 'processing' | 'success' | 'failed' | 'preview';
    previewLogId: string | null;
    totalRows: number | null;
    importedCount: number | null;
    errorCount: number | null;
    errors: string | null;
    config: string | null;
    completedAt: Date | null;
  }): Promise<void> {
    await this.db.insert(importLogs).values(data as any);
  }

  async updateLog(id: string, data: Partial<ImportLog>): Promise<void> {
    await this.db.update(importLogs).set(data).where(eq(importLogs.id, id));
  }

  async getLogById(id: string, userId: string): Promise<ImportLog | null> {
    const result = await this.db.query.importLogs.findFirst({
      where: (logs: any, { and, eq }: any) => and(eq(logs.id, id), eq(logs.userId, userId))
    });
    return (result as ImportLog) || null;
  }

  async getLogsByIds(ids: string[], userId: string): Promise<ImportLog[]> {
    if (ids.length === 0) return [];
    return (await this.db.query.importLogs.findMany({
      where: (logs: any, { and, eq, inArray }: any) => and(
        inArray(logs.id, ids),
        eq(logs.userId, userId)
      )
    })) as ImportLog[];
  }

  async getLogsPaginated(userId: string, limit: number, offset: number): Promise<PaginatedResult<ImportLog>> {
    const { data, total } = await PaginationPlugin.paginate<any>(
      this.db,
      importLogs,
      limit,
      offset,
      eq(importLogs.userId, userId)
    );

    return PaginationPlugin.toPaginatedResult(data as ImportLog[], total, limit, offset);
  }

  async deleteLogsByStatus(userId: string, status: string, olderThan: Date): Promise<number> {
    const result = await this.db.delete(importLogs).where(
      and(
        eq(importLogs.userId, userId),
        eq(importLogs.status, status as any),
        sql`${importLogs.createdAt} < ${olderThan}`
      )
    );
    return (result as any).rowCount || 0;
  }

  async findUsersByIdentifiers(identifiers: string[]): Promise<Pick<User, 'id' | 'email' | 'phoneNumber'>[]> {
    if (identifiers.length === 0) return [];
    return (await this.db.select({
      id: users.id,
      email: users.email,
      phoneNumber: users.phoneNumber
    })
    .from(users)
    .where(
      sql`${users.email} IN ${identifiers} OR ${users.phoneNumber} IN ${identifiers}`
    )) as any[];
  }

  async createDebtsBatch(debtsToCreate: any[]): Promise<void> {
    if (debtsToCreate.length === 0) return;
    await this.db.insert(debts).values(debtsToCreate as any);
  }
}
