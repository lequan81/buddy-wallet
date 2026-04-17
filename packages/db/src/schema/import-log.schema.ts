import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './user.schema';

export const importLogs = sqliteTable(
  'import_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    status: text('status')
      .$type<'pending' | 'queued' | 'processing' | 'success' | 'failed' | 'cancelled' | 'preview'>()
      .notNull()
      .default('pending'),
    // Link to preview log (for tracking preview -> import relationship)
    previewLogId: text('preview_log_id'),
    totalRows: integer('total_rows'),
    importedCount: integer('imported_count'),
    errorCount: integer('error_count'),
    /**
     * JSON array of error message strings.
     * - On success: should be `null` (never `'[]'`)
     * - On failure: JSON.stringify(errorArray)
     */
    errors: text('errors'),
    config: text('config'), // JSON of column mapping config
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: integer('completed_at', { mode: 'timestamp' }),

    // Soft delete support (Two-Stage deletion)
    deletedAt: integer('deleted_at', { mode: 'timestamp' })
  },
  (table) => [
    index('idx_import_logs_user_id').on(table.userId),
    index('idx_import_logs_user_created_at_id').on(table.userId, table.createdAt, table.id)
  ]
);

export type ImportLog = typeof importLogs.$inferSelect;
