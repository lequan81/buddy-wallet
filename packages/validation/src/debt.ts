import * as v from 'valibot';
import { SHARED_CONSTANTS } from '@repo/config';
import { phoneSchema } from './auth';

export const amountSchema = v.pipe(
  v.number('Amount must be a number'),
  v.minValue(SHARED_CONSTANTS.DEBT.MIN_AMOUNT, `Minimum amount is ${SHARED_CONSTANTS.DEBT.MIN_AMOUNT}`),
  v.maxValue(SHARED_CONSTANTS.DEBT.MAX_AMOUNT, `Maximum amount is ${SHARED_CONSTANTS.DEBT.MAX_AMOUNT}`)
);

export const amountClientSchema = v.pipe(
  v.string(),
  v.transform((val) => Number(val.replace(/,/g, ''))),
  amountSchema
);

export const descriptionSchema = v.pipe(v.string(), v.minLength(1, 'Description is required'));
export const directionSchema = v.picklist(['BORROW', 'LEND'], 'Invalid direction');

/**
 * Input schema for creating a debt (Server-side)
 */
export const CreateDebtInputSchema = v.strictObject({
  amount: amountSchema,
  description: descriptionSchema,
  counterpartyPhone: phoneSchema,
  direction: directionSchema
});

/**
 * Client-side schema for debt creation form
 * Handles string-to-number transformation for the amount field
 */
export const CreateDebtClientSchema = v.strictObject({
  ...CreateDebtInputSchema.entries,
  amount: v.pipe(
    v.string(),
    v.transform((val) => Number(val.replace(/,/g, ''))),
    amountSchema
  )
});

export type CreateDebtInput = v.InferInput<typeof CreateDebtInputSchema>;
export type CreateDebtClientInput = v.InferInput<typeof CreateDebtClientSchema>;
