/**
 * Debt Validators
 */
import { BE_ERRORS, GEN_ERRORS } from '@repo/errors';
import { SHARED_CONSTANTS } from '@repo/config';
import { CreateDebtInputSchema, safeParse } from '@repo/validation';
import { normalizePhoneNumber } from '@repo/utils';
import type { Result, CreateDebtInput } from '@repo/types';

/**
 * Validate debt amount bounds.
 */
export function validateAmount(amount: number): Result<void> | null {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return { code: 'INVALID_INPUT', error: 'Amount must be a valid number' };
  }
  if (amount < SHARED_CONSTANTS.DEBT.MIN_AMOUNT) {
    return { code: 'INVALID_INPUT', error: `Minimum debt amount is ${SHARED_CONSTANTS.DEBT.MIN_AMOUNT}` };
  }
  if (amount > SHARED_CONSTANTS.DEBT.MAX_AMOUNT) {
    return { code: 'INVALID_INPUT', error: `Maximum debt amount is ${SHARED_CONSTANTS.DEBT.MAX_AMOUNT}` };
  }
  return null;
}

/**
 * Parse and validate CreateDebtInput using schema.
 */
export function validateCreateDebtInput(input: CreateDebtInput): Result<{ amount: number; description: string; counterpartyPhone: string; direction: string }> {
  const normalizedInput = {
    ...input,
    counterpartyPhone:
      input.counterpartyPhone ||
      (input as CreateDebtInput & { phoneNumber?: string }).phoneNumber ||
      ''
  };

  const parseResult = safeParse(CreateDebtInputSchema, normalizedInput);
  if (!parseResult.success) {
    return {
      code: 'VALIDATION_ERROR',
      error: parseResult.issues[0].message
    };
  }
  return { data: parseResult.output as any };
}

/**
 * Normalize and validate a pair of phone numbers for debt creation.
 * Ensures both are valid and not the same person.
 */
export function validatePhones(
  counterpartyPhone: string,
  userPhone: string | null
): Result<{ counterparty: string; user: string }> {
  if (!userPhone) {
    return {
      code: 'PHONE_REQUIRED',
      error: BE_ERRORS.DEBT_PHONE_REQUIRED.message
    };
  }

  const normalizedCounterparty = normalizePhoneNumber(counterpartyPhone);
  if (!normalizedCounterparty) {
    return {
      code: 'INVALID_PHONE',
      error: BE_ERRORS.DEBT_INVALID_PHONE.message
    };
  }

  const normalizedUser = normalizePhoneNumber(userPhone);
  if (normalizedCounterparty === normalizedUser) {
    return {
      code: 'SELF_NOT_ALLOWED',
      error: BE_ERRORS.DEBT_SELF_NOT_ALLOWED.message
    };
  }

  return { data: { counterparty: normalizedCounterparty, user: normalizedUser! } };
}
