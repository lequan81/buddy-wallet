/**
 * Shared Constants - Used by both frontend and backend
 */

export const SHARED_CONSTANTS = {
  // File Import
  MAX_IMPORT_ROWS: 10000,
  MAX_IMPORT_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ACCEPTED_IMPORT_EXTENSIONS: ['.xlsx', '.xls', '.csv'] as const,
  ACCEPTED_IMPORT_MIME_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel', // xls
    'text/csv',
    'application/csv'
  ] as const,

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Debt Limits
  DEBT_MIN_AMOUNT: 1000,
  DEBT_MAX_AMOUNT: 1000000000000,
  MAX_BATCH_DELETE_SIZE: 50,
  DUPLICATE_CHECK_DAYS: 7,
  DUPLICATE_AMOUNT_TOLERANCE: 0.1, // 10%

  // User Limits
  MAX_DAILY_IMPORT_ROWS: 500,
  MAX_PENDING_DEBTS: 200
} as const;

/**
 * Import database field definitions (language-agnostic)
 * Labels resolved via ParaglideJS on frontend
 */
export const IMPORT_DB_FIELDS = [
  { key: 'name', required: true },
  { key: 'amount', required: true },
  { key: 'phone', required: true },
  { key: 'email', required: false },
  { key: 'description', required: false },
  { key: 'dueDate', required: false }
] as const;
