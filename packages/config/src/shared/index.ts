export * from './status';
export * from './direction';

/**
 * Shared Business Constants
 * 
 * NOTE: Values here are DEFAULTS. Local .env always takes priority.
 */
export const SHARED_CONSTANTS = {
  // File Import
  IMPORT: {
    MAX_ROWS: 10000,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    MAX_SYNC_PROCESS_SIZE: 200 * 1024,
    MAX_EMPTY_ROWS: 20,
    CHUNK_SIZE: 200,
    PREVIEW_ROWS: 5,
    STALE_LOG_LIFETIME: 24 * 60 * 60 * 1000,
    ACCEPTED_EXTENSIONS: ['.xlsx', '.xls', '.csv'] as const,
    ACCEPTED_MIME_TYPES: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ] as const,
  },

  // Pagination
  PAGINATION: {
    DEFAULT_SIZE: 20,
    MAX_SIZE: 100,
  },

  // Debt Limits
  DEBT: {
    MIN_AMOUNT: 1000,
    MAX_AMOUNT: 1000000000000,
    MAX_BATCH_DELETE: 50,
    DUPLICATE_CHECK_DAYS: 7,
    DUPLICATE_TOLERANCE: 0.1,
  },

  // User Limits
  USER: {
    MAX_DAILY_IMPORT_ROWS: 500,
    MAX_PENDING_DEBTS: 200,
    PASSWORD_MIN_LENGTH: 8,
  }
} as const;

/**
 * Import database field definitions (language-agnostic)
 */
export const IMPORT_DB_FIELDS = [
  { key: 'name', required: true },
  { key: 'amount', required: true },
  { key: 'phone', required: true },
  { key: 'email', required: false },
  { key: 'description', required: false },
  { key: 'dueDate', required: false }
] as const;
