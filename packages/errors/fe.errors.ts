/**
 * Frontend Errors (FE) - Frontend-specific errors
 */

export const FE_ERRORS = {
  // Form Errors
  FORM_INVALID: { code: 'FE_001', message: 'Form validation failed' },
  FORM_SUBMIT_FAILED: { code: 'FE_002', message: 'Form submission failed' },

  // File Errors
  FILE_NOT_SELECTED: { code: 'FE_010', message: 'No file selected' },
  FILE_TOO_LARGE: { code: 'FE_011', message: 'File size exceeds limit' },
  FILE_INVALID_TYPE: { code: 'FE_012', message: 'Invalid file type' },
  FILE_EMPTY: { code: 'FE_013', message: 'File is empty' },

  // Import Errors
  IMPORT_NO_CONFIG: { code: 'FE_020', message: 'Column mapping not configured' },
  IMPORT_MISSING_REQUIRED: { code: 'FE_021', message: 'Required columns not mapped' },
  IMPORT_PREVIEW_FAILED: { code: 'FE_022', message: 'Failed to preview file' },

  // API Errors
  API_UNREACHABLE: { code: 'FE_030', message: 'Cannot connect to server' },
  API_RESPONSE_INVALID: { code: 'FE_031', message: 'Invalid response from server' }
} as const;

export type FeErrorCode = (typeof FE_ERRORS)[keyof typeof FE_ERRORS]['code'];
