import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';
import { debts } from './debt.schema';

/**
 * Payment Proofs Table
 * Tracks individual payment proofs (receipts, screenshots) linked to debts.
 */
export const paymentProofs = sqliteTable('payment_proofs', {
  id: text('id', { length: 24 }).primaryKey(),
  debtId: text('debt_id', { length: 24 })
    .notNull()
    .references(() => debts.id, { onDelete: 'cascade' }),
  uploadedById: text('uploaded_by_id', { length: 24 })
    .notNull()
    .references(() => users.id),
  
  // File storage reference
  fileKey: text('file_key').notNull(),          // S3/storage key
  fileName: text('file_name').notNull(),        // Original filename
  fileSize: integer('file_size'),               // Size in bytes
  mimeType: text('mime_type'),                  // e.g. 'image/jpeg'
  
  // Review status
  status: text('status')
    .$type<'pending' | 'approved' | 'rejected'>()
    .notNull()
    .default('pending'),
  reviewedById: text('reviewed_by_id', { length: 24 })
    .references(() => users.id),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  rejectionReason: text('rejection_reason'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  debtIdIdx: index('idx_payment_proofs_debt_id').on(table.debtId),
  uploadedByIdx: index('idx_payment_proofs_uploaded_by').on(table.uploadedById),
  statusIdx: index('idx_payment_proofs_status').on(table.status),
  debtStatusIdx: index('idx_payment_proofs_debt_status').on(table.debtId, table.status)
}));

export type PaymentProof = typeof paymentProofs.$inferSelect;
export type NewPaymentProof = typeof paymentProofs.$inferInsert;
