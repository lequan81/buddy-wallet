/**
 * Generic Errors (GEN) - Shared between Frontend and Backend
 */

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

export type GenErrorCode = (typeof GEN_ERRORS)[keyof typeof GEN_ERRORS]['code'];
