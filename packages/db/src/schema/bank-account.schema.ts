import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { createInsertSchema } from 'drizzle-valibot';
import * as v from 'valibot';
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
    accountName: text('account_name').notNull(), // Name registered with bank

    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),

    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
  },
  (table) => ({
    userIdIdx: index('idx_bank_accounts_user_id').on(table.userId)
    // Ensure one default account per user might be handled effectively in logic or partial index if sqlite supported it well for this case,
    // but logic is safer for "one default per user" across DB flavors.
  })
);

export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;

export const insertBankAccountSchema = v.omit(
  createInsertSchema(bankAccounts, {
    bankCode: v.string('Mã ngân hàng là bắt buộc'),
    bankName: v.string('Tên ngân hàng là bắt buộc'),
    bankBin: v.string('Mã BIN ngân hàng là bắt buộc'),
    accountNumber: v.pipe(
      v.string('Số tài khoản là bắt buộc'),
      v.minLength(4, 'Số tài khoản quá ngắn')
    ),
    accountName: v.string('Tên chủ tài khoản là bắt buộc')
  }),
  ['id', 'createdAt', 'updatedAt', 'userId']
);
