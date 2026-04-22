import { injectable, inject } from 'tsyringe';
import { eq, desc, and } from '@repo/db';
import { activityLogs, type ActivityLog, type DbClient, type ActivityResource } from '@repo/db';
import type { ActivityRepositoryInterface } from '@/app/Repositories/Contracts/ActivityRepositoryInterface';
import type { ActivityFilters } from '@/app/Repositories/Contracts/Types/activity';
import type { PaginatedResult } from '@repo/types';
import { paginate } from '../Plugins/PaginationPlugin';

@injectable()
export class ActivityRepository implements ActivityRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async create(data: any): Promise<ActivityLog> {
    const [created] = await this.db.insert(activityLogs).values({
      ...data,
      createdAt: new Date()
    }).returning();
    return created as ActivityLog;
  }

  async findManyByUserId(
    userId: string,
    filters: ActivityFilters
  ): Promise<PaginatedResult<ActivityLog>> {
    const { limit = 50, offset = 0 } = filters;
    
    const { data, total } = await paginate<any>(this.db, activityLogs, limit, offset, eq(activityLogs.userId, userId));
    return {
      items: data as ActivityLog[],
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total
      }
    };
  }

  async findMany(filters: ActivityFilters): Promise<PaginatedResult<ActivityLog>> {
    const { limit = 50, offset = 0 } = filters;
    
    const { data, total } = await paginate<any>(this.db, activityLogs, limit, offset);
    return {
      items: data as ActivityLog[],
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total
      }
    };
  }

  async findByResourceId(resource: ActivityResource, resourceId: string): Promise<ActivityLog[]> {
    const data = await this.db.select()
      .from(activityLogs)
      .where(and(eq(activityLogs.resource, resource), eq(activityLogs.resourceId, resourceId)))
      .orderBy(desc(activityLogs.createdAt))
      .all();
    return data as ActivityLog[];
  }

  async findRecentByUserId(userId: string, limit: number): Promise<ActivityLog[]> {
    const data = await this.db.select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .limit(limit)
      .orderBy(desc(activityLogs.createdAt))
      .all();
    return data as ActivityLog[];
  }
}

