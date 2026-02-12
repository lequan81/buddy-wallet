/**
 * Activity Service
 *
 * Tracks all user actions for audit trail:
 * - CRUD operations (create, update, delete)
 * - Auth events (login, logout, password change)
 * - Data operations (import, export)
 */
import { randomUUIDv7 } from 'bun';
import { activityLogs, eq, desc, and, gte, lte, type ActivityLog, type ActivityAction, type ActivityResource } from '@repo/db';
import type { DbClient } from '../types';

export interface LogActivityInput {
  userId: string;
  action: ActivityAction;
  resource: ActivityResource;
  resourceId?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivityFilters {
  action?: ActivityAction;
  resource?: ActivityResource;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ActivityLogResult {
  logs: ActivityLog[];
  total: number;
  hasMore: boolean;
}

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

    // Get total count
    const countResult = this.db
      .select()
      .from(activityLogs)
      .where(and(...conditions))
      .all();
    const total = countResult.length;

    // Get paginated logs
    const logs = this.db
      .select()
      .from(activityLogs)
      .where(and(...conditions))
      .orderBy(desc(activityLogs.createdAt))
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
      ? this.db.select().from(activityLogs).where(and(...conditions)).all()
      : this.db.select().from(activityLogs).all();
    const total = countQuery.length;

    // Get paginated logs
    const logsQuery = conditions.length > 0
      ? this.db.select().from(activityLogs).where(and(...conditions))
      : this.db.select().from(activityLogs);

    const logs = logsQuery
      .orderBy(desc(activityLogs.createdAt))
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
      .orderBy(desc(activityLogs.createdAt))
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
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
      .all();
  }
}
