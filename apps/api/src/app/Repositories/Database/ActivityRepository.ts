import { injectable, inject } from 'tsyringe';
import { eq, desc, and, count } from '@repo/db';
import { activities, type ActivityLog, type DbClient, type ActivityResource } from '@repo/db';
import type { ActivityRepositoryInterface } from '@/app/Repositories/Contracts/ActivityRepositoryInterface';
import type { ActivityFilters } from '@/types/services/activity';

@injectable()
export class ActivityRepository implements ActivityRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async create(data: any): Promise<ActivityLog> {
    const [created] = await this.db.insert(activities).values({
      ...data,
      createdAt: new Date()
    }).returning();
    return created as ActivityLog;
  }

  async findManyByUserId(userId: string, filters: ActivityFilters): Promise<{ data: ActivityLog[]; pagination: { total: number } }> {
    const { limit = 50, offset = 0 } = filters;
    
    const countRes = await this.db.select({ count: count() })
      .from(activities)
      .where(eq(activities.userId, userId))
      .get();
      
    const data = await this.db.select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(activities.createdAt))
      .all();
      
    return { data: data as ActivityLog[], pagination: { total: countRes?.count ?? 0 } };
  }

  async findMany(filters: ActivityFilters): Promise<{ data: ActivityLog[]; pagination: { total: number } }> {
    const { limit = 50, offset = 0 } = filters;
    
    const countRes = await this.db.select({ count: count() })
      .from(activities)
      .get();
      
    const data = await this.db.select()
      .from(activities)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(activities.createdAt))
      .all();
      
    return { data: data as ActivityLog[], pagination: { total: countRes?.count ?? 0 } };
  }

  async findByResourceId(resource: ActivityResource, resourceId: string): Promise<ActivityLog[]> {
    const data = await this.db.select()
      .from(activities)
      .where(and(eq(activities.resource, resource), eq(activities.resourceId, resourceId)))
      .orderBy(desc(activities.createdAt))
      .all();
    return data as ActivityLog[];
  }

  async findRecentByUserId(userId: string, limit: number): Promise<ActivityLog[]> {
    const data = await this.db.select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .limit(limit)
      .orderBy(desc(activities.createdAt))
      .all();
    return data as ActivityLog[];
  }
}
