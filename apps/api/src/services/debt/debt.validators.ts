/**
 * Debt Validators — Pure Fail-Fast Validation Functions (Zone A)
 *
 * All input validation runs BEFORE any database query or side effect.
 * These are pure functions: no I/O, no state, deterministic.
 * Returns error result or null (null = valid).
 */
import { SHARED_CONSTANTS } from '@repo/config';
import { CreateDebtInputSchema, safeParse } from '@repo/validation';
import { normalizePhoneNumber } from '@utils/phone';
import type { DebtResult, CreateDebtInput } from '@repo/types';

/**
 * Validate debt amount bounds.
 * Returns DebtResult error or null if valid.
 */
export function validateAmount(amount: number): DebtResult | null {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return { success: false, error: 'Amount must be a valid number', code: 'INVALID_AMOUNT' };
  }
  if (amount < SHARED_CONSTANTS.DEBT.MIN_AMOUNT) {
    return { success: false, error: `Minimum debt amount is ${SHARED_CONSTANTS.DEBT.MIN_AMOUNT}`, code: 'AMOUNT_TOO_LOW' };
  }
  if (amount > SHARED_CONSTANTS.DEBT.MAX_AMOUNT) {
    return { success: false, error: `Maximum debt amount is ${SHARED_CONSTANTS.DEBT.MAX_AMOUNT}`, code: 'AMOUNT_TOO_HIGH' };
  }
  return null;
}

/**
 * Parse and validate CreateDebtInput using schema.
 * Returns parsed output or DebtResult error.
 */
export function validateCreateDebtInput(input: CreateDebtInput): 
  | { success: true; data: { amount: number; description: string; phoneNumber: string; direction: string } }
  | { success: false; error: DebtResult } {
  const parseResult = safeParse(CreateDebtInputSchema, input);
  if (!parseResult.success) {
    return {
      success: false,
      error: {
        success: false,
        error: parseResult.issues[0].message,
        code: 'VALIDATION_ERROR'
      }
    };
  }
  return { success: true, data: parseResult.output };
}

/**
 * Normalize and validate a pair of phone numbers for debt creation.
 * Ensures both are valid and not the same person.
 */
export function validatePhones(
  counterpartyPhone: string,
  userPhone: string | null
): { success: true; counterparty: string; user: string }
 | { success: false; error: DebtResult } {
  if (!userPhone) {
    return {
      success: false,
      error: {
        success: false,
        error: 'Please update your profile with a phone number to create debts.',
        code: 'PHONE_REQUIRED'
      }
    };
  }

  const normalizedCounterparty = normalizePhoneNumber(counterpartyPhone);
  if (!normalizedCounterparty) {
    return {
      success: false,
      error: {
        success: false,
        error: 'Invalid counterparty phone number format',
        code: 'INVALID_PHONE_FORMAT'
      }
    };
  }

  const normalizedUser = normalizePhoneNumber(userPhone);
  if (normalizedCounterparty === normalizedUser) {
    return {
      success: false,
      error: {
        success: false,
        error: 'Cannot create a debt with yourself',
        code: 'SELF_DEBT_NOT_ALLOWED'
      }
    };
  }

  return { success: true, counterparty: normalizedCounterparty, user: normalizedUser! };
}
