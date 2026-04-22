import { injectable, inject } from 'tsyringe';
import type { ActivityLog, ActivityResource } from '@repo/types';
import type { LogActivityInput, ActivityFilters, ActivityLogResult } from '@/app/Repositories/Contracts/Types/activity';
import type { ActivityRepositoryInterface } from '@/app/Repositories/Contracts/ActivityRepositoryInterface';

@injectable()
export class ActivityService {
  constructor(
    @inject('ActivityRepositoryInterface') private activityRepo: ActivityRepositoryInterface
  ) { }

  /**
   * Log an activity
   */
  async log(input: LogActivityInput): Promise<void> {
    await this.activityRepo.create({
      userId: input.userId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId || null,
      changes: input.changes || null,
      metadata: input.metadata || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      location: input.location || null
    });
  }

  /**
   * Get activity logs for a user with optional filters
   */
  async getLogsForUser(userId: string, filters: ActivityFilters = {}): Promise<ActivityLogResult> {
    return this.activityRepo.findManyByUserId(userId, filters);
  }

  /**
   * Get all activity logs (admin only) with filters
   */
  async getAllLogs(filters: ActivityFilters = {}): Promise<ActivityLogResult> {
    return this.activityRepo.findMany(filters);
  }

  /**
   * Get activity logs for a specific resource
   */
  async getLogsForResource(resource: ActivityResource, resourceId: string): Promise<ActivityLog[]> {
    return this.activityRepo.findByResourceId(resource, resourceId);
  }

  /**
   * Get recent activity for a user (dashboard summary)
   */
  async getRecentActivity(userId: string, limit = 10): Promise<ActivityLog[]> {
    return this.activityRepo.findRecentByUserId(userId, limit);
  }
}

