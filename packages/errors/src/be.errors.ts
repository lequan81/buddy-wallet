/**
 * Backend Errors (BE) - Backend-specific errors
 */

import { defineErrors } from './factory';

export const BE_ERRORS = defineErrors({
	// Database Errors
	DB_CONNECTION: { code: 'BE_001', message: 'Database connection failed', status: 503 },
	DB_QUERY: { code: 'BE_002', message: 'Database query failed', status: 500 },
	DB_INSERT: { code: 'BE_003', message: 'Failed to insert record', status: 500 },
	DB_UPDATE: { code: 'BE_004', message: 'Failed to update record', status: 500 },
	DB_DELETE: { code: 'BE_005', message: 'Failed to delete record', status: 500 },

	// Auth Errors
	AUTH_TOKEN_EXPIRED: { code: 'BE_010', message: 'Authentication token expired', status: 401 },
	AUTH_TOKEN_INVALID: { code: 'BE_011', message: 'Invalid authentication token', status: 401 },
	AUTH_SESSION_EXPIRED: { code: 'BE_012', message: 'Session expired', status: 401 },
	AUTH_INVALID_CREDENTIALS: { code: 'BE_013', message: 'Invalid email or password', status: 401 },
	AUTH_PHONE_EXISTS: { code: 'BE_014', message: 'Phone number already registered', status: 409 },
	AUTH_EMAIL_EXISTS: { code: 'BE_015', message: 'Email already registered', status: 409 },
	AUTH_INVALID_PHONE: { code: 'BE_016', message: 'Invalid phone number format', status: 400 },
	AUTH_NO_SESSION: { code: 'BE_017', message: 'No valid session', status: 401 },
	AUTH_PASSWORD_MISMATCH: { code: 'BE_018', message: 'Current password is incorrect', status: 401 },
	AUTH_ACCOUNT_LOCKED: { code: 'BE_019', message: 'Account is locked', status: 403 },
	AUTH_WEAK_PASSWORD: { code: 'BE_095', message: 'Password is too weak', status: 400 },
	AUTH_COMMON_PASSWORD: { code: 'BE_096', message: 'Password is too common', status: 400 },

	// Email Verification Errors
	EMAIL_OTP_EXPIRED: { code: 'BE_050', message: 'Verification code has expired', status: 400 },
	EMAIL_OTP_INVALID: { code: 'BE_051', message: 'Invalid verification code', status: 400 },
	EMAIL_ALREADY_VERIFIED: { code: 'BE_052', message: 'Email is already verified', status: 400 },
	EMAIL_SEND_FAILED: { code: 'BE_053', message: 'Failed to send verification email', status: 500 },
	EMAIL_TOO_MANY_ATTEMPTS: { code: 'BE_054', message: 'Too many verification attempts', status: 429 },

	// Import/Export Errors
	IMPORT_PARSE_ERROR: { code: 'BE_020', message: 'Failed to parse file', status: 400 },
	IMPORT_EMPTY_SHEET: { code: 'BE_021', message: 'File contains no data', status: 400 },
	IMPORT_INVALID_FORMAT: { code: 'BE_022', message: 'Invalid file format', status: 400 },
	IMPORT_ROW_ERROR: { code: 'BE_023', message: 'Error processing row', status: 422 },
	EXPORT_FAILED: { code: 'BE_024', message: 'Export generation failed', status: 500 },
	EXPORT_NO_DATA: { code: 'BE_025', message: 'No data to export', status: 400 },
	IMPORT_ROW_FORMAT_ERRORS: { code: 'BE_026', message: 'One or more rows contain formatting errors', status: 422 },

	// User Errors
	USER_NOT_FOUND: { code: 'BE_030', message: 'User not found', status: 404 },
	USER_INACTIVE: { code: 'BE_031', message: 'User account is inactive', status: 403 },
	PERMISSION_DENIED: { code: 'BE_032', message: 'Permission denied', status: 403 },

	// Debt Errors
	DEBT_NOT_FOUND: { code: 'BE_035', message: 'Debt not found', status: 404 },
	DEBT_INVALID_STATUS: { code: 'BE_036', message: 'Invalid status transition', status: 400 },
	DEBT_PERMISSION_DENIED: { code: 'BE_037', message: 'Not authorized to modify this debt', status: 403 },
	DEBT_PENDING_LIMIT: { code: 'BE_038', message: 'Too many unconfirmed debts', status: 400 },
	DEBT_DUPLICATE_WARNING: { code: 'BE_039', message: 'Potential duplicate debt found', status: 409 },
	DEBT_ALREADY_CONFIRMED: { code: 'BE_090', message: 'Debt already confirmed by creator', status: 400 },
	DEBT_INVALID_STATE: { code: 'BE_091', message: 'Invalid debt state for this operation', status: 400 },
	DEBT_SELF_NOT_ALLOWED: { code: 'BE_092', message: 'Cannot create a debt with yourself', status: 400 },
	DEBT_PHONE_REQUIRED: { code: 'BE_093', message: 'Phone number required to create debts', status: 400 },
	DEBT_INVALID_PHONE: { code: 'BE_094', message: 'Invalid counterparty phone number', status: 400 },

	// Rate Limiting
	RATE_LIMITED: { code: 'BE_040', message: 'Too many requests', status: 429 },

	// File Upload Errors
	FILE_TOO_LARGE: { code: 'BE_060', message: 'File size exceeds the allowed limit', status: 413 },
	FILE_INVALID_TYPE: { code: 'BE_061', message: 'File type is not allowed', status: 415 },
	FILE_UPLOAD_FAILED: { code: 'BE_062', message: 'File upload failed', status: 500 },
	FILE_NOT_FOUND: { code: 'BE_063', message: 'File not found', status: 404 },
	FILE_PERMISSION_DENIED: { code: 'BE_064', message: 'Not authorized to access this file', status: 403 },
	FILE_CONTENT_MISMATCH: { code: 'BE_065', message: 'File content does not match its extension', status: 400 },
	FILE_QUEUE_FULL: { code: 'BE_066', message: 'Upload queue is full, try again later', status: 429 },

	// Push Notification Errors
	PUSH_SUBSCRIPTION_FAILED: { code: 'BE_070', message: 'Failed to create push subscription', status: 500 },
	PUSH_SUBSCRIPTION_NOT_FOUND: { code: 'BE_071', message: 'Push subscription not found', status: 404 },
	PUSH_SEND_FAILED: { code: 'BE_072', message: 'Failed to send push notification', status: 500 },
	PUSH_INVALID_SUBSCRIPTION: { code: 'BE_073', message: 'Invalid push subscription data', status: 400 },
	PUSH_NOT_CONFIGURED: { code: 'BE_084', message: 'Push notifications not configured', status: 503 },
	NOTIFICATION_NOT_FOUND: { code: 'BE_074', message: 'Notification not found', status: 404 },

	// Session Errors
	SESSION_NOT_FOUND: { code: 'BE_097', message: 'Session not found or already revoked', status: 401 },
	SESSION_EXPIRED: { code: 'BE_098', message: 'Session has expired', status: 401 },

	// Bank Account Errors
	BANK_ACCOUNT_NOT_FOUND: { code: 'BE_080', message: 'Bank account not found', status: 404 },
	BANK_ACCOUNT_LIMIT: { code: 'BE_081', message: 'Maximum number of bank accounts reached', status: 400 },
	BANK_ACCOUNT_DUPLICATE: { code: 'BE_082', message: 'Bank account already exists', status: 409 },
	BANK_ACCOUNT_PERMISSION_DENIED: { code: 'BE_083', message: 'Not authorized to manage this bank account', status: 403 },

	// Jobs/Queue Errors
	QUEUE_UNAVAILABLE: { code: 'BE_085', message: 'Queue not available', status: 503 },
	REDIS_UNAVAILABLE: { code: 'BE_086', message: 'Redis client not ready', status: 503 },
	JOB_NOT_FOUND: { code: 'BE_087', message: 'Job not found', status: 404 },
	JOB_UNAUTHORIZED: { code: 'BE_088', message: 'Not authorized to cancel this job', status: 403 },
	JOB_INVALID_STATE: { code: 'BE_089', message: 'Cannot cancel job in current state', status: 400 },

	// Password Reset Errors
	INVALID_PHONE: { code: 'BE_100', message: 'Invalid phone number format', status: 400 },
	ACCOUNT_LOCKED: { code: 'BE_101', message: 'Account is locked. Please contact support', status: 403 },
	INVALID_RESET_LINK: { code: 'BE_102', message: 'Invalid or expired reset link', status: 400 },
	RESET_LINK_EXPIRED: { code: 'BE_103', message: 'Reset link has expired', status: 400 },
	RESET_LINK_USED: { code: 'BE_104', message: 'Reset link has already been used', status: 400 },
	CONCURRENT_RESET: { code: 'BE_105', message: 'Reset link has already been used or expired', status: 400 },

	// OTP Errors
	OTP_NOT_FOUND: { code: 'BE_106', message: 'No pending verification found', status: 404 },
	OTP_EXPIRED: { code: 'BE_107', message: 'OTP has expired. Please request a new one', status: 400 },
	OTP_MAX_ATTEMPTS: { code: 'BE_108', message: 'Too many attempts. Please request a new OTP', status: 429 },

	// User Errors (continued)
	EMAIL_VERIFICATION_REQUIRED: { code: 'BE_109', message: 'Email verification required to enable push notifications', status: 400 },
	USER_NO_EMAIL: { code: 'BE_124', message: 'User has no email address', status: 400 },

	// File Errors
	FILE_ACCESS_DENIED: { code: 'BE_110', message: 'Access denied to file', status: 403 },
	FILE_STORAGE_ERROR: { code: 'BE_111', message: 'File storage error', status: 500 },
	FILE_UNAUTHORIZED: { code: 'BE_112', message: 'Not authorized to access this file', status: 403 },

	// Export Errors
	NO_DEBTS: { code: 'BE_113', message: 'No debts to export', status: 400 },

	// Session Errors (continued)
	MISSING_TOKEN: { code: 'BE_114', message: 'No refresh token provided', status: 400 },
	ACCOUNT_DEACTIVATED: { code: 'BE_115', message: 'Account is deactivated', status: 403 },

	// File Payment Proof Errors
	FILE_ALREADY_REVIEWED: { code: 'BE_116', message: 'File already reviewed', status: 400 },
	FILE_NO_RELATED_DEBT: { code: 'BE_117', message: 'No related debt found', status: 404 },

	// Generic Input Errors
	INVALID_INPUT: { code: 'BE_118', message: 'Provide at least amount or description', status: 400 },
	FORBIDDEN: { code: 'BE_119', message: 'Creators cannot suggest edits', status: 403 },
	INVALID_STATE: { code: 'BE_120', message: 'Invalid state for this operation', status: 400 },

	// Bank Account Operation Errors
	ADD_ACCOUNT_FAILED: { code: 'BE_121', message: 'Failed to add bank account', status: 500 },
	UPDATE_ACCOUNT_FAILED: { code: 'BE_122', message: 'Failed to update bank account', status: 500 },
	GET_ACCOUNTS_FAILED: { code: 'BE_123', message: 'Failed to retrieve bank accounts', status: 500 },

	// Granular Validation Errors
	AMOUNT_INVALID: { code: 'BE_201', message: 'Invalid amount', status: 400 },
	CURRENCY_INVALID: { code: 'BE_202', message: 'Invalid currency', status: 400 },
	STATUS_TRANSITION_INVALID: { code: 'BE_203', message: 'Invalid status transition', status: 400 },
	NAME_INVALID: { code: 'BE_205', message: 'Invalid name', status: 400 },
	EMAIL_INVALID: { code: 'BE_206', message: 'Invalid email', status: 400 },
	PASSWORD_INVALID: { code: 'BE_207', message: 'Invalid password', status: 400 },
	PASSWORD_SAME: { code: 'BE_208', message: 'New password must be different from current', status: 400 },
	BANK_NAME_INVALID: { code: 'BE_209', message: 'Invalid bank name', status: 400 },
	ACCOUNT_NUMBER_INVALID: { code: 'BE_210', message: 'Invalid account number', status: 400 },
	ACCOUNT_NAME_INVALID: { code: 'BE_211', message: 'Invalid account name', status: 400 },
	EXPORT_TYPE_INVALID: { code: 'BE_212', message: 'Invalid export type', status: 400 },
	EXPORT_FORMAT_INVALID: { code: 'BE_213', message: 'Invalid export format', status: 400 },
	DATE_FORMAT_INVALID: { code: 'BE_214', message: 'Invalid date format', status: 400 },
	DATE_RANGE_INVALID: { code: 'BE_215', message: 'Invalid date range', status: 400 },
	FILE_TYPE_INVALID: { code: 'BE_216', message: 'Invalid file type', status: 400 },
	FILE_SIZE_INVALID: { code: 'BE_217', message: 'File too large', status: 400 }
} as const);

export type BeErrorCode = (typeof BE_ERRORS)[keyof typeof BE_ERRORS]['code'];
