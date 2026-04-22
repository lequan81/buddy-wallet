/**
 * Phone Validators using Valibot
 * Parallel to any existing phone validation, for gradual migration
 */
import * as v from 'valibot';
import { GEN_ERRORS } from '@repo/errors';
import { phoneSchema } from '@repo/validation';
import { normalizePhoneNumber } from '@repo/utils';

/**
 * Result type for validation functions
 */
interface ValidationResult<T> {
  data?: T;
  code?: string;
  error?: string;
}

/**
 * Validate phone number using valibot schema
 * Returns normalized phone on success
 */
export function validatePhoneValibot(phone: string): ValidationResult<string> {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: 'Invalid phone number format'
    };
  }

  const result = v.safeParse(phoneSchema, normalized);
  if (!result.success) {
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: result.issues[0].message
    };
  }

  return { data: normalized };
}

/**
 * Validate two phone numbers are different (for debt creation)
 */
export function validatePhonePairValibot(
  phone1: string,
  phone2: string
): ValidationResult<{ phone1: string; phone2: string }> {
  const result1 = validatePhoneValibot(phone1);
  if (result1.error || !result1.data) {
    return { code: result1.code, error: result1.error };
  }

  const result2 = validatePhoneValibot(phone2);
  if (result2.error || !result2.data) {
    return { code: result2.code, error: result2.error };
  }

  if (result1.data === result2.data) {
    return {
      code: GEN_ERRORS.VALIDATION.code,
      error: 'Cannot create debt with yourself'
    };
  }

  return { data: { phone1: result1.data!, phone2: result2.data! } };
}

