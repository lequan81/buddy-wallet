import { randomUUIDv7 } from 'bun';
import { eq, desc, and, count as sqlCount, activityLogs } from '@repo/db';
import type { ActivityLog, ActivityResource, DbClient } from '@repo/db';
import type { PaginatedResult } from '@repo/types';
import { db } from '@/providers/database';

/**
 * Activity Repository
 * Data access layer for activity operations
 * No DI container - uses direct db instance
 */
export class ActivityRepository {
  constructor(private readonly database: DbClient = db) {}

  async create(data: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog> {
    const [created] = await this.database.insert(activityLogs).values({
      id: randomUUIDv7(),
      ...data,
      createdAt: new Date()
    }).returning();
    return created as ActivityLog;
  }

  async findManyByUserId(
    userId: string,
    filters: { limit?: number; offset?: number }
  ): Promise<PaginatedResult<ActivityLog>> {
    const { limit = 50, offset = 0 } = filters;
    
    // FIX: use COUNT(*) instead of fetching all rows
    const [data, countResult] = await Promise.all([
      this.database.select()
        .from(activityLogs)
        .where(eq(activityLogs.userId, userId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(activityLogs.createdAt))
        .all(),
      this.database.select({ count: sqlCount() })
        .from(activityLogs)
        .where(eq(activityLogs.userId, userId))
        .get()
    ]);

    const total = countResult?.count ?? 0;

    return {
      items: data as ActivityLog[],
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: Number(total)
      }
    };
  }

  async findMany(filters: { limit?: number; offset?: number }): Promise<PaginatedResult<ActivityLog>> {
    const { limit = 50, offset = 0 } = filters;

    const [data, countResult] = await Promise.all([
      this.database.select()
        .from(activityLogs)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(activityLogs.createdAt))
        .all(),
      this.database.select({ count: sqlCount() })
        .from(activityLogs)
        .get()
    ]);

    const total = countResult?.count ?? 0;

    return {
      items: data as ActivityLog[],
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: Number(total)
      }
    };
  }

  async findByResourceId(resource: ActivityResource, resourceId: string): Promise<ActivityLog[]> {
    const data = await this.database.select()
      .from(activityLogs)
      .where(and(eq(activityLogs.resource, resource), eq(activityLogs.resourceId, resourceId)))
      .orderBy(desc(activityLogs.createdAt))
      .all();
    return data as ActivityLog[];
  }

  async findRecentByUserId(userId: string, limit: number): Promise<ActivityLog[]> {
    const data = await this.database.select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .limit(limit)
      .orderBy(desc(activityLogs.createdAt))
      .all();
    return data as ActivityLog[];
  }
}

