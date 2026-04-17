/**
 * Debt Validators using Valibot
 * Parallel to debt.ts (regex-based), for gradual migration
 */
import * as v from 'valibot';
import { GEN_ERRORS } from '@repo/errors';
import { amountSchema, CreateDebtInputSchema } from '@repo/validation';
import type { Result, CreateDebtInput } from '@repo/types';

/**
 * Validate debt amount using valibot schema
 */
export function validateAmountValibot(amount: number): Result<void> | null {
  const result = v.safeParse(amountSchema, amount);
  if (!result.success) {
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: result.issues[0].message
    };
  }
  return null;
}

/**
 * Validate CreateDebtInput using valibot schema
 */
export function validateCreateDebtInputValibot(input: CreateDebtInput): Result<{ amount: number; description: string; counterpartyPhone: string; direction: string }> {
  const result = v.safeParse(CreateDebtInputSchema, input);
  if (!result.success) {
    return {
      code: GEN_ERRORS.VALIDATION_ERROR.code,
      error: result.issues[0].message
    };
  }
  return { data: result.output as any };
}
