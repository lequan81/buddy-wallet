/**
 * Activity Mapper - HTTP Response Formatting
 *
 * Handles transformation between ActivityLog entities and response items.
 * Per Laravel convention, this is located in app/Http/Mappers/
 */
import type { ActivityLog } from '@repo/types';

export interface ActivityResponse {
  id: string;
  userId: string;
  action: string;
  target: string;
  metadata: any;
  createdAt: string;
}

/**
 * Map ActivityLog entity to API Response DTO
 */
export function toActivityResponse(log: ActivityLog): ActivityResponse {
  const createdAt = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
  return {
    id: log.id,
    userId: log.userId,
    action: log.action,
    target: log.resource,
    metadata: log.metadata,
    createdAt: createdAt.toISOString()
  };
}

/**
 * Map multiple activity logs
 */
export function toActivityResponses(logs: ActivityLog[]): ActivityResponse[] {
  return logs.map(toActivityResponse);
}
