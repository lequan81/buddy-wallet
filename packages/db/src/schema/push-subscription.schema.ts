import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';

/**
 * Push Subscriptions Table
 *
 * NOTE: This table uses WITHOUT ROWID in the migration SQL for better
 * performance on primary-key-only lookups. Drizzle ORM doesn't natively
 * support WITHOUT ROWID, so it's applied in the consolidated migration.
 */
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id', { length: 24 }).primaryKey(),
  userId: text('user_id', { length: 24 }).notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Web Push subscription data
  endpoint: text('endpoint').notNull(),
  p256dhKey: text('p256dh_key').notNull(),
  authKey: text('auth_key').notNull(),
  expirationTime: integer('expiration_time', { mode: 'timestamp' }),

  // Device info for management
  deviceName: text('device_name'),
  deviceType: text('device_type'), // 'desktop' | 'mobile' | 'tablet'

  // Status tracking
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  // Unique endpoint per user (prevent duplicate subscriptions)
  uniqueEndpoint: uniqueIndex('idx_push_subscriptions_endpoint').on(table.endpoint),
  // Index for finding subscriptions by user
  userIdIdx: index('idx_push_subscriptions_user_id').on(table.userId),
  // Index for active subscriptions
  isActiveIdx: index('idx_push_subscriptions_is_active').on(table.isActive)
}));

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
