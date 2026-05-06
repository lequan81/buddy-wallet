/**
 * Generic Errors (GEN) - Shared between Frontend and Backend
 */

import { defineErrors } from './factory';

export const GEN_ERRORS = defineErrors({
	UNKNOWN: { code: 'GEN_001', message: 'An unknown error occurred', status: 500 },
	NETWORK: { code: 'GEN_002', message: 'Network connection failed', status: 503 },
	TIMEOUT: { code: 'GEN_003', message: 'Request timed out', status: 408 },
	INVALID_INPUT: { code: 'GEN_004', message: 'Invalid input provided', status: 400 },
	NOT_FOUND: { code: 'GEN_005', message: 'Resource not found', status: 404 },
	UNAUTHORIZED: { code: 'GEN_006', message: 'Authentication required', status: 401 },
	FORBIDDEN: { code: 'GEN_007', message: 'Access denied', status: 403 },
	VALIDATION: { code: 'GEN_008', message: 'Validation failed', status: 422 }
} as const);

export type GenErrorCode = (typeof GEN_ERRORS)[keyof typeof GEN_ERRORS]['code'];
