import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';
import { debts, type DebtStatus } from './debt.schema';

/**
 * Debt Status History Table
 * Audit trail for debt status transitions.
 */
export const debtStatusHistory = sqliteTable('debt_status_history', {
  id: text('id', { length: 24 }).primaryKey(),
  debtId: text('debt_id', { length: 24 })
    .notNull()
    .references(() => debts.id, { onDelete: 'cascade' }),
  changedById: text('changed_by_id', { length: 24 })
    .notNull()
    .references(() => users.id),
  
  fromStatus: text('from_status').$type<DebtStatus>(),
  toStatus: text('to_status').$type<DebtStatus>().notNull(),
  reason: text('reason'),           // e.g. "Payment confirmed by creditor"
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  debtIdIdx: index('idx_debt_status_history_debt_id').on(table.debtId),
  debtCreatedIdx: index('idx_debt_status_history_debt_created').on(table.debtId, table.createdAt)
}));

export type DebtStatusHistory = typeof debtStatusHistory.$inferSelect;
export type NewDebtStatusHistory = typeof debtStatusHistory.$inferInsert;
