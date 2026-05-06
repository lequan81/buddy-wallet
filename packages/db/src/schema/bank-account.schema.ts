import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';

export const bankAccounts = sqliteTable(
  'bank_accounts',
  {
    id: text('id', { length: 24 }).primaryKey(),
    userId: text('user_id', { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Bank details from VietQR
    bankCode: text('bank_code').notNull(), // e.g. "VCB", "MB"
    bankName: text('bank_name').notNull(), // e.g. "Vietcombank"
    bankBin: text('bank_bin').notNull(), // BIN code for VietQR generation, e.g. "970436"

    // User account details
    accountNumber: text('account_number').notNull(),
    accountName: text('account_name'), // Name registered with bank (optional, may not be available)

    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),

    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
  },
  (table) => ({
    userIdIdx: index('idx_bank_accounts_user_id').on(table.userId),
    userDefaultIdx: index('idx_bank_accounts_user_default').on(table.userId, table.isDefault)
    // Ensure one default account per user might be handled effectively in logic or partial index if sqlite supported it well for this case,
    // but logic is safer for "one default per user" across DB flavors.
  })
);

export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
