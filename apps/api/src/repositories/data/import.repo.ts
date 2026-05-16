import { users, debts, importLogs, eq, and, sql, count as sqlCount } from '@repo/db';
import type { ImportLog, User, NewDebt, DbClient } from '@repo/db';
import type { PaginatedResult } from '@repo/types';
import { db } from '@/providers/database';

import * as v from 'valibot';

const InsertImportLogSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
  fileName: v.pipe(v.string(), v.minLength(1)),
  fileSize: v.pipe(v.number(), v.minValue(0)),
  status: v.picklist(['pending', 'queued', 'processing', 'success', 'failed', 'cancelled', 'preview']),
  previewLogId: v.optional(v.union([v.string(), v.null_()])),
  totalRows: v.optional(v.union([v.number(), v.null_()])),
  importedCount: v.optional(v.union([v.number(), v.null_()])),
  errorCount: v.optional(v.union([v.number(), v.null_()])),
  errors: v.optional(v.union([v.string(), v.null_()])),
  config: v.optional(v.union([v.string(), v.null_()])),
  completedAt: v.optional(v.union([v.date(), v.null_()]))
});

const UpdateImportLogSchema = v.partial(InsertImportLogSchema);

/**
 * Import Repository
 * Data access layer for import operations
 * No DI container - uses direct db instance
 */
export class ImportRepository {
  constructor(private readonly database: DbClient = db) {}

  async createLog(data: v.InferInput<typeof InsertImportLogSchema>): Promise<void> {
    const result = v.safeParse(InsertImportLogSchema, data);
    if (!result.success) {
      const firstIssue = result.issues[0];
      throw new Error(`Import log validation failed: ${firstIssue?.message ?? 'Invalid data'}`);
    }
    await this.database.insert(importLogs).values(data);
  }

  async updateLog(id: string, data: Partial<ImportLog>): Promise<void> {
    const result = v.safeParse(UpdateImportLogSchema, data);
    if (!result.success) {
      const firstIssue = result.issues[0];
      throw new Error(`Import log update validation failed: ${firstIssue?.message ?? 'Invalid data'}`);
    }
    await this.database.update(importLogs).set(data).where(eq(importLogs.id, id));
  }

  async getLogById(id: string, userId: string): Promise<ImportLog | null> {
    const result = await this.database.query.importLogs.findFirst({
      where: (logs, { and, eq }) => and(eq(logs.id, id), eq(logs.userId, userId))
    });
    return (result as ImportLog) || null;
  }

  async getLogsByIds(ids: string[], userId: string): Promise<ImportLog[]> {
    if (ids.length === 0) return [];
    return (await this.database.query.importLogs.findMany({
      where: (logs, { and, eq, inArray }) => and(
        inArray(logs.id, ids),
        eq(logs.userId, userId)
      )
    })) as ImportLog[];
  }

  async getLogsPaginated(userId: string, limit: number, offset: number): Promise<PaginatedResult<ImportLog>> {
    // FIX: use COUNT(*) instead of fetching all rows
    const [data, countResult] = await Promise.all([
      this.database.query.importLogs.findMany({
        where: (logs, { eq }) => eq(logs.userId, userId),
        limit,
        offset
      }),
      this.database.select({ count: sqlCount() })
        .from(importLogs)
        .where(eq(importLogs.userId, userId))
        .get()
    ]);

    const total = countResult?.count ?? 0;
    const page = Math.floor(offset / limit) + 1;

    return {
      items: data as ImportLog[],
      pagination: {
        total: Number(total),
        page,
        limit,
        offset
      }
    };
  }

  // FIX: returns actual deleted count via .returning()
  async deleteLogsByStatus(userId: string, status: string, olderThan: Date): Promise<number> {
    const result = await this.database.delete(importLogs).where(
      and(
        eq(importLogs.userId, userId),
        eq(importLogs.status, status as 'pending' | 'processing' | 'success' | 'failed' | 'preview'),
        sql`${importLogs.createdAt} < ${olderThan}`
      )
    ).returning();
    return result.length;
  }

  async findUsersByIdentifiers(identifiers: string[]): Promise<Pick<User, 'id' | 'email' | 'phoneNumber'>[]> {
    if (identifiers.length === 0) return [];
    return (await this.database.select({
      id: users.id,
      email: users.email,
      phoneNumber: users.phoneNumber
    })
    .from(users)
    .where(
      sql`${users.email} IN ${identifiers} OR ${users.phoneNumber} IN ${identifiers}`
    )) as Pick<User, 'id' | 'email' | 'phoneNumber'>[];
  }

  async createDebtsBatch(debtsToCreate: NewDebt[]): Promise<void> {
    if (debtsToCreate.length === 0) return;
    await this.database.insert(debts).values(debtsToCreate);
  }
}


