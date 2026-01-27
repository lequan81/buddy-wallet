import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';

/**
 * Session status enum
 * - active: Session is valid and can be used
 * - revoked: Session was manually revoked (logout all, admin action)
 * - expired: Session expired naturally
 * - logged_out: User explicitly logged out
 */
export type SessionStatus = 'active' | 'revoked' | 'expired' | 'logged_out';

/**
 * Revocation reasons for audit trail
 */
export type RevokedReason =
  | 'user_revoked'
  | 'user_logout'
  | 'logout_all_devices'
  | 'password_change'
  | 'admin_revoke'
  | 'suspicious_activity'
  | 'session_expired';

/**
 * Sessions table for access + refresh token authentication
 * - accessToken: Short-lived JWT (15 min)
 * - refreshToken: Long-lived secure random token (90 days)
 * - Supports soft delete for audit trail (Facebook/Instagram style)
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

  // Session status (soft delete support)
  status: text('status').$type<SessionStatus>().notNull().default('active'),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  revokedReason: text('revoked_reason').$type<RevokedReason>(),

  // Device information for session management UI
  deviceName: text('device_name'), // "Chrome on Windows"
  deviceType: text('device_type'), // 'desktop', 'mobile', 'tablet'
  location: text('location'), // "Hanoi, Vietnam" (from IP geolocation)

  // Metadata for security auditing
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  lastRefreshedAt: integer('last_refreshed_at', { mode: 'timestamp' }),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
