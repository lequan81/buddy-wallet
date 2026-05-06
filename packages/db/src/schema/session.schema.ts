import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
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
 * - accessTokenHash: Hashed access token for secure storage
 * - refreshToken: Long-lived secure random token (90 days) - stored hashed
 * - Supports soft delete for audit trail (Facebook/Instagram style)
 *
 * SECURITY UPDATE (2026-02-05):
 * Access tokens are stored hashed to prevent theft if database is compromised.
 */
export const sessions = sqliteTable('sessions', {
  id: text('id', { length: 24 }).primaryKey(),
  userId: text('user_id', { length: 24 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Access token (short-lived JWT) - SECURITY: stored hashed only
  accessTokenHash: text('access_token_hash'), // NEW: Hashed token for secure storage
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

  // Soft delete support (Two-Stage deletion)
  // Stage 1: deletedAt set (record hidden from queries)
  // Stage 2: Hard delete by cleanup worker after 30 days
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  // Critical: Session lookup by user + status (most common query)
  userIdStatusIdx: index('idx_sessions_user_status').on(table.userId, table.status),

  // Access token hash lookup (authentication - called on every request)
  accessTokenHashIdx: index('idx_sessions_access_token_hash').on(table.accessTokenHash),

  // Composite index for session validation
  userAccessHashStatusIdx: index('idx_sessions_user_access_hash_status').on(
    table.userId,
    table.accessTokenHash,
    table.status
  ),

  // Cleanup queries - find expired sessions
  statusExpiresIdx: index('idx_sessions_status_expires').on(
    table.status,
    table.refreshTokenExpiresAt
  ),

  // Soft delete cleanup
  deletedAtIdx: index('idx_sessions_deleted_at').on(table.deletedAt)
}));

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
