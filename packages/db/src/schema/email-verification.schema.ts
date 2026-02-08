import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';

/**
 * Email Verifications Table
 *
 * Stores OTP codes for email verification with rate limiting support.
 * OTP is stored as hash for security.
 */
export const emailVerifications = sqliteTable(
  'email_verifications',
  {
    id: text('id', { length: 24 }).primaryKey(),
    userId: text('user_id', { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    otpHash: text('otp_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
    lastSentAt: integer('last_sent_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
  },
  (table) => ({
    // Index for quick lookup by userId
    userIdIdx: index('idx_email_verifications_user_id').on(table.userId),
    // Index for lookup by email
    emailIdx: index('idx_email_verifications_email').on(table.email),
    // Composite index for active verification lookup
    userEmailIdx: index('idx_email_verifications_user_email').on(
      table.userId,
      table.email,
      table.verified
    )
  })
);

export type EmailVerification = typeof emailVerifications.$inferSelect;
export type NewEmailVerification = typeof emailVerifications.$inferInsert;
