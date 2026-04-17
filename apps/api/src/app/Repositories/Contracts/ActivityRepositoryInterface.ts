import type { ActivityLog, ActivityResource } from '@repo/db';
import type { ActivityFilters } from '@/types/services/activity';

export interface ActivityRepositoryInterface {
  create(data: any): Promise<ActivityLog>;
  findManyByUserId(userId: string, filters: ActivityFilters): Promise<{ data: ActivityLog[]; pagination: { total: number } }>;
  findMany(filters: ActivityFilters): Promise<{ data: ActivityLog[]; pagination: { total: number } }>;
  findByResourceId(resource: ActivityResource, resourceId: string): Promise<ActivityLog[]>;
  findRecentByUserId(userId: string, limit: number): Promise<ActivityLog[]>;
}
