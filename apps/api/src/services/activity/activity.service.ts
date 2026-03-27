/**
 * Activity Service
 *
 * Tracks all user actions for audit trail:
 * - CRUD operations (create, update, delete)
 * - Auth events (login, logout, password change)
 * - Data operations (import, export)
 */
import { randomUUIDv7 } from 'bun';
import { activityLogs, eq, desc, and, gte, lte, count, type ActivityLog, type ActivityResource } from '@repo/db';
import type { DbClient } from '@/types';
import type { LogActivityInput, ActivityFilters, ActivityLogResult } from '@/types/services/activity';

/**
 * ActivityService class with dependency injection
 */
export class ActivityService {
  constructor(private db: DbClient) { }

  /**
   * Log an activity
   */
  async log(input: LogActivityInput): Promise<void> {
    const id = randomUUIDv7('base64url');

    await this.db.insert(activityLogs).values({
      id,
      userId: input.userId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId || null,
      changes: input.changes || null,
      metadata: input.metadata || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      location: input.location || null,
      createdAt: new Date()
    });
  }

  /**
   * Get activity logs for a user with optional filters
   */
  async getLogsForUser(userId: string, filters: ActivityFilters = {}): Promise<ActivityLogResult> {
    const { action, resource, resourceId, startDate, endDate, limit = 50, offset = 0 } = filters;

    // Build conditions array
    const conditions = [eq(activityLogs.userId, userId)];

    if (action) {
      conditions.push(eq(activityLogs.action, action));
    }
    if (resource) {
      conditions.push(eq(activityLogs.resource, resource));
    }
    if (resourceId) {
      conditions.push(eq(activityLogs.resourceId, resourceId));
    }
    if (startDate) {
      conditions.push(gte(activityLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(activityLogs.createdAt, endDate));
    }

    const countResult = this.db
      .select({ count: count() })
      .from(activityLogs)
      .where(and(...conditions))
      .get();
    const total = countResult?.count ?? 0;

    const logs = this.db
      .select()
      .from(activityLogs)
      .where(and(...conditions))
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .limit(limit)
      .offset(offset)
      .all();

    return {
      logs,
      total,
      hasMore: offset + logs.length < total
    };
  }

  /**
   * Get all activity logs (admin only) with filters
   */
  async getAllLogs(filters: ActivityFilters = {}): Promise<ActivityLogResult> {
    const { action, resource, resourceId, startDate, endDate, limit = 50, offset = 0 } = filters;

    // Build conditions array
    const conditions: ReturnType<typeof eq>[] = [];

    if (action) {
      conditions.push(eq(activityLogs.action, action));
    }
    if (resource) {
      conditions.push(eq(activityLogs.resource, resource));
    }
    if (resourceId) {
      conditions.push(eq(activityLogs.resourceId, resourceId));
    }
    if (startDate) {
      conditions.push(gte(activityLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(activityLogs.createdAt, endDate));
    }

    // Get total count
    const countQuery = conditions.length > 0
      ? this.db.select({ count: count() }).from(activityLogs).where(and(...conditions)).get()
      : this.db.select({ count: count() }).from(activityLogs).get();
    const total = countQuery?.count ?? 0;

    // Get paginated logs
    const logsQuery = conditions.length > 0
      ? this.db.select().from(activityLogs).where(and(...conditions))
      : this.db.select().from(activityLogs);

    const logs = logsQuery
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .limit(limit)
      .offset(offset)
      .all();

    return {
      logs,
      total,
      hasMore: offset + logs.length < total
    };
  }

  /**
   * Get activity logs for a specific resource
   */
  async getLogsForResource(resource: ActivityResource, resourceId: string): Promise<ActivityLog[]> {
    return this.db
      .select()
      .from(activityLogs)
      .where(and(
        eq(activityLogs.resource, resource),
        eq(activityLogs.resourceId, resourceId)
      ))
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .all();
  }

  /**
   * Get recent activity for a user (dashboard summary)
   */
  async getRecentActivity(userId: string, limit = 10): Promise<ActivityLog[]> {
    return this.db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .limit(limit)
      .all();
  }
}
