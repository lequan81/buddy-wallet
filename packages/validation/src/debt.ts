import * as v from 'valibot';
import { DEBT_MIN_AMOUNT, DEBT_MAX_AMOUNT } from '@repo/config';
import { phoneSchema } from './auth';

export const amountSchema = v.pipe(
  v.number('Amount must be a number'),
  v.minValue(DEBT_MIN_AMOUNT, `Minimum amount is ${DEBT_MIN_AMOUNT}`),
  v.maxValue(DEBT_MAX_AMOUNT, `Maximum amount is ${DEBT_MAX_AMOUNT}`)
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
  phoneNumber: phoneSchema,
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
