/**
 * Debt Validators using Valibot
 * 
 * Standardized validation logic using shared schemas from @repo/validation.
 */
import * as v from 'valibot';
import { GEN_ERRORS } from '@repo/errors';
import { amountSchema, CreateDebtInputSchema, phoneSchema } from '@repo/validation';
import type { Result, CreateDebtInput } from '@repo/types';

/**
 * Validate debt amount
 */
export function validateAmount(amount: number): Result<void> {
  const result = v.safeParse(amountSchema, amount);
  if (!result.success) {
    const firstIssue = result.issues?.[0];
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: firstIssue?.message ?? 'Invalid amount'
    };
  }
  return { data: undefined };
}

/**
 * Validate CreateDebtInput
 */
export function validateCreateDebtInput(input: CreateDebtInput): Result<CreateDebtInput> {
  const result = v.safeParse(CreateDebtInputSchema, input);
  if (!result.success) {
    const firstIssue = result.issues?.[0];
    return {
      code: GEN_ERRORS.VALIDATION.code,
      error: firstIssue?.message ?? 'Validation failed'
    };
  }
  return { data: result.output as CreateDebtInput };
}

/**
 * Validate and normalize counterparty and user phone numbers
 * 
 * @returns Result with normalized phones
 */
export function validatePhones(counterpartyPhone: string, userPhone: string | null): Result<{ counterparty: string; user: string | null }> {
  const cpResult = v.safeParse(phoneSchema, counterpartyPhone);
  if (!cpResult.success) {
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: `Invalid counterparty phone: ${counterpartyPhone}`
    };
  }

  let normalizedUser = null;
  if (userPhone) {
    const userResult = v.safeParse(phoneSchema, userPhone);
    if (!userResult.success) {
      return {
        code: GEN_ERRORS.INVALID_INPUT.code,
        error: `Invalid user phone: ${userPhone}`
      };
    }
    normalizedUser = userResult.output;
  }

  return {
    data: {
      counterparty: cpResult.output,
      user: normalizedUser
    }
  };
}
