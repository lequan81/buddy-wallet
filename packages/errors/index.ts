/**
 * @repo/errors - Shared Error Codes Package
 *
 * Error Code Format: {CATEGORY}_{NUMBER}
 * Categories:
 *   - GEN: Generic errors (shared between FE/BE)
 *   - FE:  Frontend-specific errors
 *   - BE:  Backend-specific errors
 */

// ============================================
// GENERIC ERRORS (GEN) - Shared FE/BE
// ============================================
export const GEN_ERRORS = {
  UNKNOWN: { code: 'GEN_001', message: 'An unknown error occurred' },
  NETWORK: { code: 'GEN_002', message: 'Network connection failed' },
  TIMEOUT: { code: 'GEN_003', message: 'Request timed out' },
  INVALID_INPUT: { code: 'GEN_004', message: 'Invalid input provided' },
  NOT_FOUND: { code: 'GEN_005', message: 'Resource not found' },
  UNAUTHORIZED: { code: 'GEN_006', message: 'Authentication required' },
  FORBIDDEN: { code: 'GEN_007', message: 'Access denied' },
  VALIDATION: { code: 'GEN_008', message: 'Validation failed' }
} as const;

// ============================================
// FRONTEND ERRORS (FE)
// ============================================
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

// ============================================
// BACKEND ERRORS (BE)
// ============================================
export const BE_ERRORS = {
  // Database Errors
  DB_CONNECTION: { code: 'BE_001', message: 'Database connection failed' },
  DB_QUERY: { code: 'BE_002', message: 'Database query failed' },
  DB_INSERT: { code: 'BE_003', message: 'Failed to insert record' },
  DB_UPDATE: { code: 'BE_004', message: 'Failed to update record' },
  DB_DELETE: { code: 'BE_005', message: 'Failed to delete record' },

  // Auth Errors
  AUTH_TOKEN_EXPIRED: { code: 'BE_010', message: 'Authentication token expired' },
  AUTH_TOKEN_INVALID: { code: 'BE_011', message: 'Invalid authentication token' },
  AUTH_SESSION_EXPIRED: { code: 'BE_012', message: 'Session expired' },
  AUTH_INVALID_CREDENTIALS: { code: 'BE_013', message: 'Invalid email or password' },
  AUTH_PHONE_EXISTS: { code: 'BE_014', message: 'Phone number already registered' },
  AUTH_EMAIL_EXISTS: { code: 'BE_015', message: 'Email already registered' },
  AUTH_INVALID_PHONE: { code: 'BE_016', message: 'Invalid phone number format' },
  AUTH_NO_SESSION: { code: 'BE_017', message: 'No valid session' },
  AUTH_PASSWORD_MISMATCH: { code: 'BE_018', message: 'Current password is incorrect' },

  // Email Verification Errors
  EMAIL_OTP_EXPIRED: { code: 'BE_050', message: 'Verification code has expired' },
  EMAIL_OTP_INVALID: { code: 'BE_051', message: 'Invalid verification code' },
  EMAIL_ALREADY_VERIFIED: { code: 'BE_052', message: 'Email is already verified' },
  EMAIL_SEND_FAILED: { code: 'BE_053', message: 'Failed to send verification email' },
  EMAIL_TOO_MANY_ATTEMPTS: { code: 'BE_054', message: 'Too many verification attempts' },

  // Import/Export Errors
  IMPORT_PARSE_ERROR: { code: 'BE_020', message: 'Failed to parse file' },
  IMPORT_EMPTY_SHEET: { code: 'BE_021', message: 'File contains no data' },
  IMPORT_INVALID_FORMAT: { code: 'BE_022', message: 'Invalid file format' },
  IMPORT_ROW_ERROR: { code: 'BE_023', message: 'Error processing row' },
  EXPORT_FAILED: { code: 'BE_024', message: 'Export generation failed' },
  EXPORT_NO_DATA: { code: 'BE_025', message: 'No data to export' },

  // User Errors
  USER_NOT_FOUND: { code: 'BE_030', message: 'User not found' },
  USER_INACTIVE: { code: 'BE_031', message: 'User account is inactive' },

  // Debt Errors
  DEBT_NOT_FOUND: { code: 'BE_035', message: 'Debt not found' },
  DEBT_INVALID_STATUS: { code: 'BE_036', message: 'Invalid status transition' },
  DEBT_PERMISSION_DENIED: { code: 'BE_037', message: 'Not authorized to modify this debt' },

  // Rate Limiting
  RATE_LIMITED: { code: 'BE_040', message: 'Too many requests' },

  // File Upload Errors
  FILE_TOO_LARGE: { code: 'BE_060', message: 'File size exceeds the allowed limit' },
  FILE_INVALID_TYPE: { code: 'BE_061', message: 'File type is not allowed' },
  FILE_UPLOAD_FAILED: { code: 'BE_062', message: 'File upload failed' },
  FILE_NOT_FOUND: { code: 'BE_063', message: 'File not found' },
  FILE_PERMISSION_DENIED: { code: 'BE_064', message: 'Not authorized to access this file' },
  FILE_CONTENT_MISMATCH: { code: 'BE_065', message: 'File content does not match its extension' },
  FILE_QUEUE_FULL: { code: 'BE_066', message: 'Upload queue is full, try again later' },

  // Push Notification Errors
  PUSH_SUBSCRIPTION_FAILED: { code: 'BE_070', message: 'Failed to create push subscription' },
  PUSH_SUBSCRIPTION_NOT_FOUND: { code: 'BE_071', message: 'Push subscription not found' },
  PUSH_SEND_FAILED: { code: 'BE_072', message: 'Failed to send push notification' },
  PUSH_INVALID_SUBSCRIPTION: { code: 'BE_073', message: 'Invalid push subscription data' },

  // Bank Account Errors
  BANK_ACCOUNT_NOT_FOUND: { code: 'BE_080', message: 'Bank account not found' },
  BANK_ACCOUNT_LIMIT: { code: 'BE_081', message: 'Maximum number of bank accounts reached' },
  BANK_ACCOUNT_DUPLICATE: { code: 'BE_082', message: 'Bank account already exists' },
  BANK_ACCOUNT_PERMISSION_DENIED: { code: 'BE_083', message: 'Not authorized to manage this bank account' }
} as const;

// ============================================
// TYPE DEFINITIONS
// ============================================
export type GenErrorCode = (typeof GEN_ERRORS)[keyof typeof GEN_ERRORS]['code'];
export type FeErrorCode = (typeof FE_ERRORS)[keyof typeof FE_ERRORS]['code'];
export type BeErrorCode = (typeof BE_ERRORS)[keyof typeof BE_ERRORS]['code'];
export type ErrorCode = GenErrorCode | FeErrorCode | BeErrorCode;

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: string;
}

/**
 * Standardized API Response format
 * All API responses should follow this structure for consistency
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

// ============================================
// UTILITIES
// ============================================

/** Check if error code is from frontend */
export const isFrontendError = (code: string): boolean => code.startsWith('FE_');

/** Check if error code is from backend */
export const isBackendError = (code: string): boolean => code.startsWith('BE_');

/** Check if error code is generic */
export const isGenericError = (code: string): boolean => code.startsWith('GEN_');

/** Get error category from code */
export const getErrorCategory = (code: string): 'GEN' | 'FE' | 'BE' | 'UNKNOWN' => {
  if (code.startsWith('GEN_')) return 'GEN';
  if (code.startsWith('FE_')) return 'FE';
  if (code.startsWith('BE_')) return 'BE';
  return 'UNKNOWN';
};

/** Create an AppError object */
export const createError = (
  error: { code: string; message: string },
  details?: string
): AppError => ({
  code: error.code as ErrorCode,
  message: error.message,
  details
});

/**
 * Create a standardized error response for API endpoints
 * @param error - Error definition from GEN_ERRORS, BE_ERRORS, or FE_ERRORS
 * @param details - Optional additional details about the error
 */
export const errorResponse = (
  error: { code: string; message: string },
  details?: string
): ApiResponse => ({
  success: false,
  error: {
    code: error.code,
    message: error.message,
    ...(details && { details })
  }
});

/**
 * Create a standardized success response for API endpoints
 * @param data - The response data
 */
export const successResponse = <T>(data?: T): ApiResponse<T> => ({
  success: true,
  ...(data !== undefined && { data })
});

