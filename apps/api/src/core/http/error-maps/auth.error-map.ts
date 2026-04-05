import { BE_ERRORS, GEN_ERRORS } from '@repo/errors';
import type { ServiceErrorMap, ServiceErrorMapEntry } from '@/core/http/result-helper';

export const AUTH_REGISTER_ERROR_MAP: ServiceErrorMap = {
  'Invalid phone number format': {
    status: 400,
    error: BE_ERRORS.AUTH_INVALID_PHONE
  },
  'Phone number already registered': {
    status: 400,
    error: BE_ERRORS.AUTH_PHONE_EXISTS
  },
  'Email already registered': {
    status: 400,
    error: BE_ERRORS.AUTH_EMAIL_EXISTS
  }
};

export const DEFAULT_AUTH_REGISTER_FAILURE: ServiceErrorMapEntry = {
  status: 400,
  error: GEN_ERRORS.INVALID_INPUT
};
