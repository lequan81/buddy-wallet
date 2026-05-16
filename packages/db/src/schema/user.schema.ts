import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id', { length: 24 }).primaryKey(),
  name: text('name').notNull(),
  phoneNumber: text('phone_number').notNull().unique(),
  email: text('email').unique(), // Optional
  password: text('password').notNull(),
  role: text('role').notNull().default('user'),
  permissions: text('permissions', { mode: 'json' }).$type<string[]>().default([]),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

  // Account security
  isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
  lockoutUntil: integer('lockout_until', { mode: 'timestamp' }),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lastFailedLoginAt: integer('last_failed_login_at', { mode: 'timestamp' }),

  // Verification
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  phoneVerified: integer('phone_verified', { mode: 'boolean' }).notNull().default(false),

  // Session management - increment to invalidate all sessions
  sessionVersion: integer('session_version').notNull().default(1),
  lastPasswordChangeAt: integer('last_password_change_at', { mode: 'timestamp' }),

  // Notification preferences
  emailNotificationsEnabled: integer('email_notifications_enabled', { mode: 'boolean' }).notNull().default(false),
  pushNotificationsEnabled: integer('push_notifications_enabled', { mode: 'boolean' }).notNull().default(false),

  // Password reset
  temporaryPassword: text('temporary_password'),
  temporaryPasswordExpires: integer('temporary_password_expires', { mode: 'timestamp' }),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
  temporaryPasswordUsed: integer('temporary_password_used', { mode: 'boolean' }).notNull().default(false),

  // Avatar image processing
  avatarThumbnailKey: text('avatar_thumbnail_key'),
  avatarMediumKey: text('avatar_medium_key'),
  avatarUpdatedAt: integer('avatar_updated_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  // Index for role-based queries (admin dashboard)
  roleIdx: index('idx_users_role').on(table.role),
  // Index for active user filtering
  isActiveIdx: index('idx_users_is_active').on(table.isActive),
  // Index for locked account queries
  isLockedIdx: index('idx_users_is_locked').on(table.isLocked),
  // Composite index for locked account cleanup
  lockedUntilIdx: index('idx_users_locked_until').on(table.isLocked, table.lockoutUntil)
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
