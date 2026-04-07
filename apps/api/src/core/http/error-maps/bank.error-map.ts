import { BE_ERRORS, GEN_ERRORS, type ErrorDefinition } from '@repo/errors';

export const BANK_ERROR_MAP: Record<string, { status: number; error: ErrorDefinition }> = {
  'Account not found': {
    status: 404,
    error: BE_ERRORS.BANK_ACCOUNT_NOT_FOUND
  },
  'Not authorized': {
    status: 403,
    error: BE_ERRORS.BANK_ACCOUNT_PERMISSION_DENIED
  },
  'Duplicate account': {
    status: 400,
    error: GEN_ERRORS.INVALID_INPUT
  },
  'DATABASE_ERROR': {
    status: 503,
    error: BE_ERRORS.DB_CONNECTION
  }
};

export const DEFAULT_BANK_FAILURE = {
  status: 400,
  error: GEN_ERRORS.UNKNOWN
};
