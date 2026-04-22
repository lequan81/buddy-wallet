import type { ActivityLog, ActivityResource, PaginatedResult } from '@repo/types';
import type { ActivityFilters } from './Types/activity';

export interface ActivityRepositoryInterface {
  create(data: any): Promise<ActivityLog>;
  findManyByUserId(userId: string, filters: ActivityFilters): Promise<PaginatedResult<ActivityLog>>;
  findMany(filters: ActivityFilters): Promise<PaginatedResult<ActivityLog>>;
  findByResourceId(resource: ActivityResource, resourceId: string): Promise<ActivityLog[]>;
  findRecentByUserId(userId: string, limit: number): Promise<ActivityLog[]>;
}

