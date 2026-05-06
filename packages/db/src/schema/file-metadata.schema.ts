import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';

/**
 * File Metadata Schema
 *
 * Stores metadata for uploaded files (QR codes, payment proofs).
 * Actual files are stored on filesystem, only metadata/URL stored in DB.
 */
export const fileMetadata = sqliteTable(
  'file_metadata',
  {
    id: text('id', { length: 24 }).primaryKey(),

    // File info
    mimeType: text('mime_type').notNull(), // Always 'image/webp' after processing
    sizeBytes: integer('size_bytes').notNull(), // File size after processing
    storagePath: text('storage_path').notNull(), // Relative path: uploads/qr/abc123.webp

    // Ownership
    uploadedById: text('uploaded_by_id', { length: 24 })
      .notNull()
      .references(() => users.id),

    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
  },
  (table) => ({
    uploadedByIdx: index('idx_file_metadata_uploaded_by').on(table.uploadedById),
    uploadedCreatedIdx: index('idx_file_metadata_uploaded_created_at').on(table.uploadedById, table.createdAt, table.id),
    storagePathIdx: index('idx_file_metadata_storage_path').on(table.storagePath)
  })
);

export type FileMetadata = typeof fileMetadata.$inferSelect;
export type NewFileMetadata = typeof fileMetadata.$inferInsert;
