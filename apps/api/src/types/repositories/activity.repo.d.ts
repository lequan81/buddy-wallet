import type { ActivityLog, ActivityResource } from '@repo/db';
import type { PaginatedResult } from '@repo/types';

export interface IActivityRepository {
  create(data: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<void>;
  findMany(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<ActivityLog>>;
  findManyByUserId(
    userId: string,
    filters: {
      action?: string;
      resource?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<PaginatedResult<ActivityLog>>;
  findByResourceId(resource: ActivityResource, resourceId: string): Promise<ActivityLog[]>;
  findRecentByUserId(userId: string, limit?: number): Promise<ActivityLog[]>;
}
