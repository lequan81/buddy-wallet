/**
 * Frontend Errors (FE) - Frontend-specific errors
 */

import { defineErrors } from './factory';

export const FE_ERRORS = defineErrors({
	// Form Errors
	FORM_INVALID: { code: 'FE_001', message: 'Form validation failed', status: 400 },
	FORM_SUBMIT_FAILED: { code: 'FE_002', message: 'Form submission failed', status: 500 },

	// File Errors
	FILE_NOT_SELECTED: { code: 'FE_010', message: 'No file selected', status: 400 },
	FILE_TOO_LARGE: { code: 'FE_011', message: 'File size exceeds limit', status: 413 },
	FILE_INVALID_TYPE: { code: 'FE_012', message: 'Invalid file type', status: 415 },
	FILE_EMPTY: { code: 'FE_013', message: 'File is empty', status: 400 },
	EMPTY_SHEET: { code: 'FE_014', message: 'File contains no data', status: 400 },
	INVALID_FILE_FORMAT: { code: 'FE_015', message: 'Invalid file format', status: 400 },

	// Import Errors
	IMPORT_NO_CONFIG: { code: 'FE_020', message: 'Column mapping not configured', status: 400 },
	IMPORT_MISSING_REQUIRED: { code: 'FE_021', message: 'Required columns not mapped', status: 400 },
	IMPORT_PREVIEW_FAILED: { code: 'FE_022', message: 'Failed to preview file', status: 500 },
	INVALID_MAPPING: { code: 'FE_023', message: 'Name and Amount columns required', status: 400 },
	INCOMPLETE_MAPPING: { code: 'FE_024', message: 'Incomplete mapping: Name and Amount columns are required', status: 400 },
	NO_DATA_ROWS: { code: 'FE_025', message: 'No data rows found', status: 400 },

	// API Errors
	API_UNREACHABLE: { code: 'FE_030', message: 'Cannot connect to server', status: 503 },
	API_RESPONSE_INVALID: { code: 'FE_031', message: 'Invalid response from server', status: 502 }
} as const);

export type FeErrorCode = (typeof FE_ERRORS)[keyof typeof FE_ERRORS]['code'];
