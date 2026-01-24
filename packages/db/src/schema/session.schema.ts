import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';

/**
 * Sessions table for access + refresh token authentication
 * - accessToken: Short-lived JWT (15 min)
 * - refreshToken: Long-lived secure random token (90 days)
 */
export const sessions = sqliteTable('sessions', {
  id: text('id', { length: 24 }).primaryKey(),
  userId: text('user_id', { length: 24 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Access token (short-lived JWT)
  accessToken: text('access_token').notNull(),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }).notNull(),

  // Refresh token (long-lived, stored hashed)
  refreshToken: text('refresh_token').notNull().unique(),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }).notNull(),

  // Metadata for security auditing
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  lastRefreshedAt: integer('last_refreshed_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
