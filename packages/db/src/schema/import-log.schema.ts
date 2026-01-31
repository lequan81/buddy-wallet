import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';

export const importLogs = sqliteTable('import_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  status: text('status', { enum: ['pending', 'processing', 'success', 'failed'] })
    .notNull()
    .default('pending'),
  // Link to preview log (for tracking preview -> import relationship)
  previewLogId: text('preview_log_id'),
  totalRows: integer('total_rows'),
  importedCount: integer('imported_count'),
  errorCount: integer('error_count'),
  errors: text('errors'), // JSON array of error messages
  config: text('config'), // JSON of column mapping config
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),

  // Soft delete support (Two-Stage deletion)
  deletedAt: integer('deleted_at', { mode: 'timestamp' })
});
