/**
 * Phone Validators using TypeBox + TypeCompiler
 */
import { t } from 'elysia';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { GEN_ERRORS } from '@repo/errors';
import { normalizePhoneNumber } from '@repo/utils';
import type { Result } from '@repo/types';

export const PhoneSchema = t.String({
  minLength: 10,
  maxLength: 20
});

const phoneValidator = TypeCompiler.Compile(PhoneSchema);

function getFirstErrorMessage(errors: Iterable<{ message?: string }>, fallback: string): string {
  for (const error of errors) {
    return error.message ?? fallback;
  }
  return fallback;
}

/**
 * Validate phone number using TypeBox schema
 * Returns normalized phone on success
 */
export function validatePhone(phone: string): Result<string> {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: 'Invalid phone number format'
    };
  }

  if (!phoneValidator.Check(normalized)) {
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: getFirstErrorMessage(phoneValidator.Errors(normalized), 'Invalid phone number')
    };
  }

  return { data: normalized };
}

/**
 * Validate two phone numbers are different (for debt creation)
 */
export function validatePhonePair(
  phone1: string,
  phone2: string
): Result<{ phone1: string; phone2: string }> {
  const result1 = validatePhone(phone1);
  if ('code' in result1) {
    return { code: result1.code, error: result1.error };
  }

  const result2 = validatePhone(phone2);
  if ('code' in result2) {
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

