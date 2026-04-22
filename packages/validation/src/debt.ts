import * as v from 'valibot';
import { SHARED_CONSTANTS } from '@repo/config/shared';
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
  counterpartyPhone: phoneSchema,
  amount: amountSchema,
  direction: directionSchema,
  description: v.optional(v.string()),
  counterpartyName: v.optional(v.string()),
  dueDate: v.optional(v.nullable(v.union([v.date(), v.string()]))),
  status: v.optional(v.picklist(['pending', 'confirmed', 'disputed', 'paid', 'cancelled'] as const))
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

/**
 * Debt Status Schema
 */
export const debtStatusSchema = v.picklist(['pending', 'confirmed', 'disputed', 'paid', 'cancelled'] as const);
export type DebtStatus = v.InferInput<typeof debtStatusSchema>;

/**
 * Debt Direction Schema
 */
export const debtDirectionSchema = v.picklist(['owed', 'owing'] as const);
export type DebtDirection = v.InferInput<typeof debtDirectionSchema>;

/**
 * Debt Query Schema (Pagination & Filtering)
 */
export const debtQuerySchema = v.strictObject({
  status: v.optional(debtStatusSchema),
  direction: v.optional(debtDirectionSchema),
  page: v.pipe(v.optional(v.number(), 1), v.minValue(1)),
  limit: v.pipe(v.optional(v.number(), 20), v.minValue(1), v.maxValue(100))
});

export type DebtQueryInput = v.InferInput<typeof debtQuerySchema>;

/**
 * Update Debt Status Schema
 */
export const updateDebtStatusSchema = v.strictObject({
  status: v.picklist(['confirmed', 'disputed', 'paid', 'cancelled'] as const),
  notes: v.optional(v.string())
});

export type UpdateDebtStatusInput = v.InferInput<typeof updateDebtStatusSchema>;
