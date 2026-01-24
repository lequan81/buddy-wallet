import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
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
});

export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
