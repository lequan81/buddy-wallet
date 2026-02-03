import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';
import { debts } from './debt.schema';

/**
 * File Metadata Schema
 *
 * Stores metadata for uploaded files (QR codes, payment proofs).
 * Actual files are stored on filesystem, only metadata/URL stored in DB.
 */
export const fileMetadata = sqliteTable('file_metadata', {
  id: text('id', { length: 24 }).primaryKey(),

  // File info
  filename: text('filename').notNull(), // Generated unique filename
  originalName: text('original_name').notNull(), // User's original filename
  mimeType: text('mime_type').notNull(), // Always 'image/webp' after processing
  sizeBytes: integer('size_bytes').notNull(), // File size after processing
  storagePath: text('storage_path').notNull(), // Relative path: uploads/qr/abc123.webp

  // Ownership
  uploadedById: text('uploaded_by_id', { length: 24 })
    .notNull()
    .references(() => users.id),

  // Type: 'qr_code' | 'payment_proof'
  fileType: text('file_type').notNull(),

  // For payment proofs - link to debt
  relatedDebtId: text('related_debt_id', { length: 24 }).references(() => debts.id),

  // Approval workflow (for payment proofs)
  // pending → approved | rejected
  status: text('status').notNull().default('pending'),
  reviewedById: text('reviewed_by_id', { length: 24 }).references(() => users.id),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  rejectionReason: text('rejection_reason'),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export type FileMetadata = typeof fileMetadata.$inferSelect;
export type NewFileMetadata = typeof fileMetadata.$inferInsert;

// File type enum
export type FileType = 'qr_code' | 'payment_proof';

// File status enum
export type FileStatus = 'pending' | 'approved' | 'rejected';
