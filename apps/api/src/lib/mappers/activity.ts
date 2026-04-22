/**
 * Activity Mapper - Domain Transformations
 *
 * Handles transformation between Database ActivityLog entities and domain objects.
 */
import type { ActivityLog, ActivityResource } from '@repo/db';
import type { LogActivityInput, ActivityFilters } from '@/app/Repositories/Contracts/Types/activity';
import type { PaginatedResult } from '@repo/types';

/**
 * Activity Log domain object (internal use)
 */
export interface ActivityLogInfo {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  changes: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  } | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
  createdAt: Date;
}

/**
 * Map database activity log entity to domain object
 */
export function toActivityInfo(log: ActivityLog): ActivityLogInfo {
  return {
    id: log.id,
    userId: log.userId,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    changes: log.changes as ActivityLogInfo['changes'],
    metadata: log.metadata as Record<string, unknown> | null,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    location: log.location,
    createdAt: log.createdAt
  };
}

/**
 * Map multiple activity logs to domain objects
 */
export function toActivityInfoList(logs: ActivityLog[]): ActivityLogInfo[] {
  return logs.map(toActivityInfo);
}

/**
 * Build ActivityLogResult with pagination from raw data
 */
export function buildActivityLogResult(
  items: ActivityLog[],
  total: number,
  filters: ActivityFilters
): PaginatedResult<ActivityLogInfo> {
  const { limit = 50, offset = 0 } = filters;

  return {
    items: toActivityInfoList(items),
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total
    }
  };
}
