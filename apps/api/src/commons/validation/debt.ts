/**
 * Debt Validators using Valibot
 */
import * as v from 'valibot';
import { GEN_ERRORS } from '@repo/errors';
import { SHARED_CONSTANTS } from '@repo/config';
import type { Result, CreateDebtInput } from '@repo/types';
import { PhoneSchema, validatePhone } from './phone';

const AmountSchema = v.pipe(
  v.number(),
  v.minValue(SHARED_CONSTANTS.DEBT.MIN_AMOUNT),
  v.maxValue(SHARED_CONSTANTS.DEBT.MAX_AMOUNT)
);

const DebtDirectionSchema = v.picklist(['BORROW', 'LEND']);

const DebtStatusSchema = v.picklist([
  'pending',
  'confirmed',
  'disputed',
  'paid',
  'cancelled'
]);

const CreateDebtInputSchema = v.object({
  counterpartyPhone: PhoneSchema,
  amount: AmountSchema,
  direction: DebtDirectionSchema,
  description: v.optional(v.string()),
  counterpartyName: v.optional(v.string()),
  dueDate: v.optional(v.union([v.date(), v.string(), v.null_()])),
  status: v.optional(DebtStatusSchema)
});

/**
 * Validate debt amount
 */
export function validateAmount(amount: number): Result<void> {
  const result = v.safeParse(AmountSchema, amount);
  if (!result.success) {
    const firstIssue = result.issues[0];
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
    const firstIssue = result.issues[0];
    return {
      code: GEN_ERRORS.VALIDATION.code,
      error: firstIssue?.message ?? 'Validation failed'
    };
  }
  return { data: input };
}

/**
 * Validate and normalize counterparty and user phone numbers
 * 
 * @returns Result with normalized phones
 */
export function validatePhones(counterpartyPhone: string, userPhone: string | null): Result<{ counterparty: string; user: string | null }> {
  const counterpartyResult = validatePhone(counterpartyPhone);
  if ('code' in counterpartyResult) {
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: `Invalid counterparty phone: ${counterpartyPhone}`
    };
  }

  let normalizedUser = null;
  if (userPhone) {
    const userResult = validatePhone(userPhone);
    if ('code' in userResult) {
      return {
        code: GEN_ERRORS.INVALID_INPUT.code,
        error: `Invalid user phone: ${userPhone}`
      };
    }
    normalizedUser = userResult.data;
  }

  return {
    data: {
      counterparty: counterpartyResult.data,
      user: normalizedUser
    }
  };
}
