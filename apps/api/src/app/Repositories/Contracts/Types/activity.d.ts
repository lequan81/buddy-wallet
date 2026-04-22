/**
 * Activity Service Type Definitions
 * Extracted from activity.service.ts for decoupled type management.
 */
import type { ActivityLog, ActivityAction, ActivityResource, PaginatedResult } from '@repo/types';

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
  location?: string;
}

export interface ActivityFilters {
  userId?: string;
  action?: ActivityAction;
  resource?: ActivityResource;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
export type ActivityLogResult = PaginatedResult<ActivityLog>;

