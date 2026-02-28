import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';

/**
 * Activity Logs table for audit trail
 * Tracks all user actions: CRUD operations, auth events, data operations
 */
export const activityLogs = sqliteTable(
  'activity_logs',
  {
    id: text('id', { length: 24 }).primaryKey(),

    // Who performed the action
    userId: text('user_id', { length: 24 })
      .notNull()
      .references(() => users.id),

    // What action was performed
    action: text('action').notNull(), // 'create', 'update', 'delete', 'login', 'logout', 'export', 'import', 'status_change'

    // What resource was affected
    resource: text('resource').notNull(), // 'debt', 'user', 'session', 'import', 'export'
    resourceId: text('resource_id', { length: 24 }), // ID of the affected resource

    // Change details (JSON)
    changes: text('changes', { mode: 'json' }).$type<{
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    }>(),

    // Additional metadata (JSON)
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),

    // Request context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    location: text('location'),

    // Timestamp
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
  },
  (table) => ({
    // Index for user's activity
    userIdIdx: index('idx_activity_logs_user_id').on(table.userId),

    // Index for filtering by action type
    actionIdx: index('idx_activity_logs_action').on(table.action),

    // Index for filtering by resource type
    resourceIdx: index('idx_activity_logs_resource').on(table.resource),

    // Composite index for user + date queries (most common)
    userCreatedAtIdx: index('idx_activity_logs_user_created_at').on(table.userId, table.createdAt),

    // Index for resource lookups
    resourceIdIdx: index('idx_activity_logs_resource_id').on(table.resource, table.resourceId)
  })
);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;

// Type-safe action types
export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'export'
  | 'import'
  | 'status_change'
  | 'password_change'
  | 'logout_all'
  | 'delete_all'
  | 'login_failed'
  // Auth actions
  | 'register'
  | 'verify_email'
  | 'revoke_session'
  // Debt confirmation and suggestions
  | 'confirm'
  | 'suggest_edit'
  | 'accept_suggestion'
  | 'reject_suggestion'
  // File/proof actions
  | 'upload'
  | 'approve'
  | 'reject'
  // Push subscription actions
  | 'subscribe'
  | 'unsubscribe'
  | 'broadcast'
  // Debt statuses as actions
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'disputed'
  | 'cancelled';

// Type-safe resource types
export type ActivityResource = 'debt' | 'user' | 'session' | 'import' | 'export' | 'bank_account' | 'file' | 'push_subscription';
