import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';

export type DebtStatus = 'pending' | 'confirmed' | 'paid' | 'disputed' | 'cancelled';

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
  debtorId: text('debtor_id', { length: 24 }).references(() => users.id, { onDelete: 'set null' }),
  creditorId: text('creditor_id', { length: 24 }).references(() => users.id, { onDelete: 'set null' }),

  // Who uploaded this debt record
  uploadedById: text('uploaded_by_id', { length: 24 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Debt details
  amount: integer('amount').notNull(), // Amount in smallest currency unit
  currency: text('currency', { length: 3 }).notNull().default('USD'), // ISO 4217 currency code
  description: text('description'),
  status: text('status').notNull().default('pending').$type<DebtStatus>(), // pending, confirmed, paid, disputed

  // Confirmation tracking (for two-party verification)
  confirmedByCreditor: integer('confirmed_by_creditor', { mode: 'boolean' }).notNull().default(false),
  confirmedByDebtor: integer('confirmed_by_debtor', { mode: 'boolean' }).notNull().default(false),
  needsConfirmation: integer('needs_confirmation', { mode: 'boolean' }).notNull().default(true),
  creditorConfirmedAt: integer('creditor_confirmed_at', { mode: 'timestamp' }),
  debtorConfirmedAt: integer('debtor_confirmed_at', { mode: 'timestamp' }),

  // Payment proof tracking
  hasPendingProof: integer('has_pending_proof', { mode: 'boolean' }).notNull().default(false),
  proofCount: integer('proof_count').notNull().default(0),
  lastProofUploadedAt: integer('last_proof_uploaded_at', { mode: 'timestamp' }),

  // Expiry for unconfirmed debts (null = never expires)
  expiresAt: integer('expires_at', { mode: 'timestamp' }),

  // Suggested edit from counterparty (pending edit request)
  suggestedAmount: integer('suggested_amount'),
  suggestedDescription: text('suggested_description'),
  suggestedById: text('suggested_by_id', { length: 24 }).references(() => users.id),
  suggestedAt: integer('suggested_at', { mode: 'timestamp' }),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }) // Soft delete support
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
  statusCreatedAtIdIdx: index('idx_debts_status_created_at_id').on(table.status, table.createdAt, table.id),
  debtorIdCreatedAtIdIdx: index('idx_debts_debtor_created_at_id').on(table.debtorId, table.createdAt, table.id),
  creditorIdCreatedAtIdIdx: index('idx_debts_creditor_created_at_id').on(table.creditorId, table.createdAt, table.id),

  // Cursor-friendly and involved-user list indexes
  debtorStatusDeletedCreatedIdIdx: index('idx_debts_debtor_status_deleted_created_id')
    .on(table.debtorId, table.status, table.deletedAt, table.createdAt, table.id),
  creditorStatusDeletedCreatedIdIdx: index('idx_debts_creditor_status_deleted_created_id')
    .on(table.creditorId, table.status, table.deletedAt, table.createdAt, table.id),
  uploadedDeletedCreatedIdIdx: index('idx_debts_uploaded_deleted_created_id')
    .on(table.uploadedById, table.deletedAt, table.createdAt, table.id)
}));

export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
