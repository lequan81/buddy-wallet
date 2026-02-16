import * as v from 'valibot';
import { DEBT_MIN_AMOUNT, DEBT_MAX_AMOUNT } from '@repo/config';

/**
 * Input schema for creating a debt
 * - Enforces business rules (Min/Max amount)
 * - Validates phone number format
 */
export const CreateDebtInputSchema = v.object({
  amount: v.pipe(
    v.number('Amount must be a number'),
    v.minValue(DEBT_MIN_AMOUNT, `Minimum amount is ${DEBT_MIN_AMOUNT}`),
    v.maxValue(DEBT_MAX_AMOUNT, `Maximum amount is ${DEBT_MAX_AMOUNT}`)
  ),
  description: v.optional(v.string()),
  counterpartyPhone: v.pipe(
    v.string('Counterparty phone is required'),
    v.minLength(10, 'Phone number invalid'),
    v.maxLength(15, 'Phone number invalid')
  ),
  direction: v.picklist(['BORROW', 'LEND'], 'Invalid direction')
});

export type CreateDebtInput = v.InferInput<typeof CreateDebtInputSchema>;
