/**
 * Backend Errors (BE) - Backend-specific errors
 */

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
  AUTH_ACCOUNT_LOCKED: { code: 'BE_019', message: 'Account is locked' },
  AUTH_WEAK_PASSWORD: { code: 'BE_095', message: 'Password is too weak' },
  AUTH_COMMON_PASSWORD: { code: 'BE_096', message: 'Password is too common' },

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
  IMPORT_ROW_FORMAT_ERRORS: { code: 'BE_026', message: 'One or more rows contain formatting errors' },

  // User Errors
  USER_NOT_FOUND: { code: 'BE_030', message: 'User not found' },
  USER_INACTIVE: { code: 'BE_031', message: 'User account is inactive' },

  // Debt Errors
  DEBT_NOT_FOUND: { code: 'BE_035', message: 'Debt not found' },
  DEBT_INVALID_STATUS: { code: 'BE_036', message: 'Invalid status transition' },
  DEBT_PERMISSION_DENIED: { code: 'BE_037', message: 'Not authorized to modify this debt' },
  DEBT_PENDING_LIMIT: { code: 'BE_038', message: 'Too many unconfirmed debts' },
  DEBT_DUPLICATE_WARNING: { code: 'BE_039', message: 'Potential duplicate debt found' },
  DEBT_ALREADY_CONFIRMED: { code: 'BE_090', message: 'Debt already confirmed by creator' },
  DEBT_INVALID_STATE: { code: 'BE_091', message: 'Invalid debt state for this operation' },
  DEBT_SELF_NOT_ALLOWED: { code: 'BE_092', message: 'Cannot create a debt with yourself' },
  DEBT_PHONE_REQUIRED: { code: 'BE_093', message: 'Phone number required to create debts' },
  DEBT_INVALID_PHONE: { code: 'BE_094', message: 'Invalid counterparty phone number' },

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

  // Session Errors
  SESSION_NOT_FOUND: { code: 'BE_097', message: 'Session not found or already revoked' },
  SESSION_EXPIRED: { code: 'BE_098', message: 'Session has expired' },

  // Bank Account Errors
  BANK_ACCOUNT_NOT_FOUND: { code: 'BE_080', message: 'Bank account not found' },
  BANK_ACCOUNT_LIMIT: { code: 'BE_081', message: 'Maximum number of bank accounts reached' },
  BANK_ACCOUNT_DUPLICATE: { code: 'BE_082', message: 'Bank account already exists' },
  BANK_ACCOUNT_PERMISSION_DENIED: { code: 'BE_083', message: 'Not authorized to manage this bank account' }
} as const;

export type BeErrorCode = (typeof BE_ERRORS)[keyof typeof BE_ERRORS]['code'];
