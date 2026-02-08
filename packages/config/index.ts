/**
 * @repo/config - Shared Configuration & Constants
 *
 * Contains shared constants used by both frontend and backend.
 */

// ============================================
// FILE IMPORT CONFIGURATION
// ============================================

// Helper to get env var safely across environments (Vite, Bun, Node)
const getEnv = (key: string, def: string) => {
  try {
    // @ts-ignore - Vite
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key])
      return import.meta.env[key];
    // @ts-ignore - Bun
    if (typeof Bun !== 'undefined' && Bun.env && Bun.env[key]) return Bun.env[key];
    // @ts-ignore - Node
    if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  } catch {}
  return def;
};

/** Accepted file extensions for spreadsheet import */
export const ACCEPTED_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;

/** Accepted MIME types for spreadsheet import */
export const ACCEPTED_IMPORT_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'text/csv',
  'application/csv'
] as const;

/** Check if file extension is valid for import */
export const isValidImportFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return ACCEPTED_IMPORT_EXTENSIONS.includes(ext as (typeof ACCEPTED_IMPORT_EXTENSIONS)[number]);
};

/** Get accept string for file input */
export const getImportAcceptString = (): string => ACCEPTED_IMPORT_EXTENSIONS.join(',');

// ============================================
// API CONFIGURATION
// ============================================

/** API base URL - should be overridden by env in production */
export const API_BASE_URL = 'http://localhost:3000';

/** Web base URL - should be overridden by env in production */
export const WEB_BASE_URL = getEnv('VITE_WEB_URL', 'http://localhost:5173');

// ============================================
// PAGINATION DEFAULTS
// ============================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ============================================
// FILE SIZE LIMITS
// ============================================

/** Max file size for import (5MB) */
export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

/** Max rows to process in import */
export const MAX_IMPORT_ROWS = 10000;

// ============================================
// SECURITY VALIDATION
// ============================================

export * from './security';
export * from './env';

// ============================================
// DEBT CONFIGURATION
// ============================================

/** Minimum debt amount (1,000 VND) */
export const DEBT_MIN_AMOUNT = 1000;

/** Maximum debt amount (1 Trillion VND) */
export const DEBT_MAX_AMOUNT = 1000000000000;

// ============================================
// EXTERNAL SERVICES
// ============================================

export const VIETQR_API_URL = getEnv('VIETQR_API_URL', 'https://api.vietqr.io/v2/banks');
export const VIETQR_TIMEOUT = Number(getEnv('VIETQR_TIMEOUT', '5000'));
