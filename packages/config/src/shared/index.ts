export * from './status';
export * from './direction';
export * from './security';
export * from './banks';

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

/**
 * Debt Constants (Legacy aliases for easier import)
 */
export const MAX_PENDING_DEBTS = SHARED_CONSTANTS.USER.MAX_PENDING_DEBTS;
export const DUPLICATE_CHECK_DAYS = SHARED_CONSTANTS.DEBT.DUPLICATE_CHECK_DAYS;
export const DUPLICATE_AMOUNT_TOLERANCE = SHARED_CONSTANTS.DEBT.DUPLICATE_TOLERANCE;
export const MAX_BATCH_DELETE_SIZE = SHARED_CONSTANTS.DEBT.MAX_BATCH_DELETE;
export const MIN_DEBT_AMOUNT = SHARED_CONSTANTS.DEBT.MIN_AMOUNT;

/**
 * File Import Helpers
 */
export const ACCEPTED_IMPORT_EXTENSIONS = SHARED_CONSTANTS.IMPORT.ACCEPTED_EXTENSIONS;
export const ACCEPTED_IMPORT_MIME_TYPES = SHARED_CONSTANTS.IMPORT.ACCEPTED_MIME_TYPES;
export const MAX_IMPORT_FILE_SIZE = SHARED_CONSTANTS.IMPORT.MAX_FILE_SIZE;

export function isValidImportFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return (ACCEPTED_IMPORT_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Frontend Constants - Shared across web app
 */
export const FRONTEND_CONSTANTS = {
  TOAST_DURATION_MS: 3000,
  ANIMATION_DURATION_MS: 200,
  MAX_UPLOAD_SIZE_MB: 5
} as const;

/**
 * Image Storage Constants
 */
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
] as const;
