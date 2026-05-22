/**
 * Activity Logging Helper
 * @logicType backend
 *
 * Provides a simple interface for logging user activities across handlers.
 * Uses fire-and-forget pattern to avoid blocking request processing.
 *
 * NOTE: Repositories are the only consumers of @repo/db.
 * This module defines its own action/resource types to avoid direct @repo/db imports.
 */

import { ActivityRepository } from '@/repositories/system/activity.repo';
import { logger } from '@repo/logger';
import type { LogActivityParams } from '@repo/types/api';

const activityRepo = new ActivityRepository();

/**
 * Log an activity in the background (non-blocking).
 * Failures are logged but do not affect the request.
 */
export function logActivity(params: LogActivityParams): void {
  Promise.resolve().then(async () => {
    try {
      await activityRepo.create({
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        changes: params.changes ?? null,
        metadata: params.metadata ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        location: null
      });
    } catch (error) {
      logger.error('Failed to log activity', {
        error: String(error),
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId
      });
    }
  });
}
