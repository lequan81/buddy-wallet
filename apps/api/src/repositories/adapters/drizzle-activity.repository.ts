import { activityLogs, eq, desc, and, gte, lte, count, type ActivityLog, type ActivityResource } from '@repo/db';
import type { DbClient } from '@/types';
import type { PaginatedResult } from '@repo/types';
import type { IActivityRepository } from '@/types/repositories';
import type { ActivityFilters } from '@/types';
import { randomUUIDv7 } from 'bun';

export class DrizzleActivityRepository implements IActivityRepository {
  constructor(private db: DbClient) {}

  async create(data: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<void> {
    const id = randomUUIDv7('base64url');
    await this.db.insert(activityLogs).values({
      id,
      ...data,
      createdAt: new Date()
    });
  }

  async findMany(filters: ActivityFilters & { limit?: number; offset?: number }): Promise<PaginatedResult<ActivityLog>> {
    const { limit = 50, offset = 0 } = filters;
    const conditions = this.buildConditions(filters);

    const countPromise = conditions.length > 0
      ? this.db.select({ count: count() }).from(activityLogs).where(and(...conditions)).get()
      : this.db.select({ count: count() }).from(activityLogs).get();

    const logsQuery = conditions.length > 0
      ? this.db.select().from(activityLogs).where(and(...conditions))
      : this.db.select().from(activityLogs);

    const logsPromise = logsQuery
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .limit(limit)
      .offset(offset)
      .all();

    const [countRes, logsRes] = await Promise.allSettled([countPromise, logsPromise]);

    if (countRes.status === 'rejected') {
      throw new Error(`Database count query failed: ${String(countRes.reason)}`);
    }
    if (logsRes.status === 'rejected') {
      throw new Error(`Database logs query failed: ${String(logsRes.reason)}`);
    }

    const total = countRes.value?.count ?? 0;
    const logs = logsRes.value as ActivityLog[];

    return {
      success: true,
      data: logs,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total
      }
    };
  }

  async findManyByUserId(userId: string, filters: ActivityFilters & { limit?: number; offset?: number }): Promise<PaginatedResult<ActivityLog>> {
    return this.findMany({ ...filters, userId });
  }

  async findByResourceId(resource: ActivityResource, resourceId: string): Promise<ActivityLog[]> {
    return this.db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.resource, resource), eq(activityLogs.resourceId, resourceId)))
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .all() as ActivityLog[];
  }

  async findRecentByUserId(userId: string, limit = 10): Promise<ActivityLog[]> {
    return this.db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .limit(limit)
      .all() as ActivityLog[];
  }

  private buildConditions(filters: ActivityFilters & { userId?: string }) {
    const conditions = [];
    if (filters.userId) conditions.push(eq(activityLogs.userId, filters.userId));
    if (filters.action) conditions.push(eq(activityLogs.action, filters.action));
    if (filters.resource) conditions.push(eq(activityLogs.resource, filters.resource));
    if (filters.resourceId) conditions.push(eq(activityLogs.resourceId, filters.resourceId));
    if (filters.startDate) conditions.push(gte(activityLogs.createdAt, filters.startDate));
    if (filters.endDate) conditions.push(lte(activityLogs.createdAt, filters.endDate));
    return conditions;
  }
}
