// Explicit named exports for tree-shaking
// Format utilities
export {
  formatVND,
  normalizePhoneNumber,
  formatPhoneDisplay,
  maskPhone,
  formatCurrency,
  formatDate,
  sanitizeFileName,
  colLetterToIndex
} from './format';

// File validation utilities
export {
  isValidSpreadsheetBytes,
  isValidImageBytes
} from './file-validation';

// Cursor utilities
export type { CursorPayload } from './cursor';
export { encodeCursor, decodeCursor } from './cursor';

// Retry utilities
export type { RetryConfig } from './retry';
export { withRetry } from './retry';

// CSV utilities
export {
  parseCSV,
  colToZeroBasedIndex,
  indexToColumnLetter,
  escapeCSVCell,
  buildCSV
} from './csv';

/**
 * Converts a string to an optional string (undefined if empty).
 */
export const toOptional = (value: string | undefined): string | undefined =>
  (value && value.trim() ? value : undefined);
