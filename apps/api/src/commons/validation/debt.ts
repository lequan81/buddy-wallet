/**
 * Debt Validators using TypeBox + TypeCompiler
 */
import { t } from 'elysia';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { GEN_ERRORS } from '@repo/errors';
import { SHARED_CONSTANTS } from '@repo/config';
import type { Result, CreateDebtInput } from '@repo/types';
import { PhoneSchema, validatePhone } from './phone';

const AmountSchema = t.Number({
  minimum: SHARED_CONSTANTS.DEBT.MIN_AMOUNT,
  maximum: SHARED_CONSTANTS.DEBT.MAX_AMOUNT
});

const DebtDirectionSchema = t.Union([t.Literal('BORROW'), t.Literal('LEND')]);

const DebtStatusSchema = t.Union([
  t.Literal('pending'),
  t.Literal('confirmed'),
  t.Literal('disputed'),
  t.Literal('paid'),
  t.Literal('cancelled')
]);

const CreateDebtInputSchema = t.Object({
  counterpartyPhone: PhoneSchema,
  amount: AmountSchema,
  direction: DebtDirectionSchema,
  description: t.Optional(t.String()),
  counterpartyName: t.Optional(t.String()),
  dueDate: t.Optional(t.Union([t.Date(), t.String(), t.Null()])),
  status: t.Optional(DebtStatusSchema)
});

const amountValidator = TypeCompiler.Compile(AmountSchema);
const createDebtValidator = TypeCompiler.Compile(CreateDebtInputSchema);

function getFirstErrorMessage(errors: Iterable<{ message?: string }>, fallback: string): string {
  for (const error of errors) {
    return error.message ?? fallback;
  }
  return fallback;
}

/**
 * Validate debt amount
 */
export function validateAmount(amount: number): Result<void> {
  if (!amountValidator.Check(amount)) {
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: getFirstErrorMessage(amountValidator.Errors(amount), 'Invalid amount')
    };
  }
  return { data: undefined };
}

/**
 * Validate CreateDebtInput
 */
export function validateCreateDebtInput(input: CreateDebtInput): Result<CreateDebtInput> {
  if (!createDebtValidator.Check(input)) {
    return {
      code: GEN_ERRORS.VALIDATION.code,
      error: getFirstErrorMessage(createDebtValidator.Errors(input), 'Validation failed')
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
