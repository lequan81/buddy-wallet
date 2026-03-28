/**
 * Activity Service
 *
 * Tracks all user actions for audit trail:
 * - CRUD operations (create, update, delete)
 * - Auth events (login, logout, password change)
 * - Data operations (import, export)
 */
// No unused imports
import { type ActivityLog, type ActivityResource } from '@repo/db';
import type { IActivityRepository } from '@repo/types';
import type { LogActivityInput, ActivityFilters, ActivityLogResult } from '@/types/services/activity';

/**
 * ActivityService class with dependency injection
 */
export class ActivityService {
  constructor(private activityRepo: IActivityRepository) { }

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
    const result = await this.activityRepo.findManyByUserId(userId, filters);
    return {
      logs: result.data,
      total: result.pagination.total,
      hasMore: (filters.offset || 0) + result.data.length < result.pagination.total
    };
  }

  /**
   * Get all activity logs (admin only) with filters
   */
  async getAllLogs(filters: ActivityFilters = {}): Promise<ActivityLogResult> {
    const result = await this.activityRepo.findMany(filters);
    return {
      logs: result.data,
      total: result.pagination.total,
      hasMore: (filters.offset || 0) + result.data.length < result.pagination.total
    };
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
