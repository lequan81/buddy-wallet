import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';
import { debts } from './debt.schema';

/**
 * Debt Suggestions Table
 * Tracks history of suggested edits (amount, description) between debtor and creditor.
 */
export const debtSuggestions = sqliteTable('debt_suggestions', {
  id: text('id', { length: 24 }).primaryKey(),
  debtId: text('debt_id', { length: 24 })
    .notNull()
    .references(() => debts.id, { onDelete: 'cascade' }),
  suggestedById: text('suggested_by_id', { length: 24 })
    .notNull()
    .references(() => users.id),
  
  // Suggested values
  amount: integer('amount').notNull(),
  description: text('description'),
  
  // Suggestion status
  status: text('status')
    .$type<'pending' | 'accepted' | 'rejected' | 'cancelled'>()
    .notNull()
    .default('pending'),
  
  responseNote: text('response_note'), // Reason for rejection or acceptance comment
  respondedAt: integer('responded_at', { mode: 'timestamp' }),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  debtIdIdx: index('idx_debt_suggestions_debt_id').on(table.debtId),
  suggestedByIdx: index('idx_debt_suggestions_suggested_by').on(table.suggestedById),
  statusIdx: index('idx_debt_suggestions_status').on(table.status)
}));

export type DebtSuggestion = typeof debtSuggestions.$inferSelect;
export type NewDebtSuggestion = typeof debtSuggestions.$inferInsert;
