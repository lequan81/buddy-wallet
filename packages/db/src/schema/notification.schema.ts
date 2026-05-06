import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './user.schema';
import { sql } from 'drizzle-orm';

/**
 * Notifications Table
 * Stores in-app notifications for users.
 */
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    // Notification Type (e.g., 'debt_created', 'debt_confirmed', 'system_message')
    type: text('type').notNull(),
    // Content
    title: text('title').notNull(),
    message: text('message').notNull(),
    // Metadata (JSON stringified)
    data: text('data'),
    // Status
    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    readAt: integer('read_at', { mode: 'timestamp' }),
    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' })
  },
  (table) => ({
    userIdIdx: index('idx_notifications_user_id').on(table.userId),
    userReadIdx: index('idx_notifications_user_read').on(table.userId, table.isRead),
    userCreatedIdx: index('idx_notifications_user_created_at').on(table.userId, table.createdAt, table.id)
  })
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
