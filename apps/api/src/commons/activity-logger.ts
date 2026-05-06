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

const activityRepo = new ActivityRepository();

/** Activity action types — mirrors @repo/db ActivityAction without importing it */
export type ActivityAction =
  | 'create' | 'update' | 'delete'
  | 'login' | 'logout' | 'login_failed'
  | 'export' | 'import' | 'import_preview' | 'status_change'
  | 'password_change' | 'logout_all' | 'delete_all'
  | 'register' | 'verify_email' | 'revoke_session'
  | 'confirm' | 'suggest_edit' | 'accept_suggestion' | 'reject_suggestion'
  | 'upload' | 'approve' | 'reject'
  | 'subscribe' | 'unsubscribe' | 'broadcast';

/** Activity resource types — mirrors @repo/db ActivityResource without importing it */
export type ActivityResource =
  | 'debt' | 'user' | 'session' | 'import' | 'export'
  | 'bank_account' | 'file' | 'push_subscription';

interface LogActivityParams {
  userId: string;
  action: ActivityAction;
  resource: ActivityResource;
  resourceId?: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

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
