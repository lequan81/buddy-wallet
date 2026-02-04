import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';

/**
 * Debts table with phone-based linking
 * - debtorPhone/creditorPhone: Primary identifiers (always required)
 * - debtorId/creditorId: Optional, linked when user registers with matching phone
 */
export const debts = sqliteTable('debts', {
  id: text('id', { length: 24 }).primaryKey(),

  // Phone-based identifiers (always set)
  debtorPhone: text('debtor_phone').notNull(), // Phone of who owes money
  creditorPhone: text('creditor_phone').notNull(), // Phone of who is owed money

  // User ID links (set when users register with matching phone)
  debtorId: text('debtor_id', { length: 24 }).references(() => users.id),
  creditorId: text('creditor_id', { length: 24 }).references(() => users.id),

  // Who uploaded this debt record
  uploadedById: text('uploaded_by_id', { length: 24 })
    .notNull()
    .references(() => users.id),

  // Debt details
  amount: integer('amount').notNull(), // Amount in smallest currency unit
  description: text('description'),
  status: text('status').notNull().default('pending'), // pending, confirmed, paid, disputed

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  // Index for user's debts lookup (most common query)
  debtorIdIdx: index('idx_debts_debtor_id').on(table.debtorId),
  creditorIdIdx: index('idx_debts_creditor_id').on(table.creditorId),

  // Composite index for phone + status queries (public lookup)
  debtorPhoneStatusIdx: index('idx_debts_debtor_phone_status').on(table.debtorPhone, table.status),
  creditorPhoneStatusIdx: index('idx_debts_creditor_phone_status').on(table.creditorPhone, table.status),

  // Index for status filtering (dashboard, reports)
  statusIdx: index('idx_debts_status').on(table.status),

  // Index for uploaded by (admin queries, user's uploads)
  uploadedByIdx: index('idx_debts_uploaded_by').on(table.uploadedById),

  // Composite index for date-based queries
  statusCreatedAtIdx: index('idx_debts_status_created_at').on(table.status, table.createdAt)
}));

export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
