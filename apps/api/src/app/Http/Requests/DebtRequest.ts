/**
 * Debt Request DTOs
 *
 * Validation schemas for debt endpoints using Valibot.
 */

import * as v from 'valibot';
import {
  CreateDebtInputSchema,
  updateDebtStatusSchema,
  debtQuerySchema
} from '@repo/validation';

/**
 * Create debt request
 */
export const CreateDebtRequest = CreateDebtInputSchema;
export type CreateDebtRequest = v.InferInput<typeof CreateDebtRequest>;

/**
 * Update debt status request
 */
export const UpdateDebtStatusRequest = updateDebtStatusSchema;
export type UpdateDebtStatusRequest = v.InferInput<typeof UpdateDebtStatusRequest>;

/**
 * Debt query parameters
 */
export const DebtQueryRequest = debtQuerySchema;
export type DebtQueryRequest = v.InferInput<typeof DebtQueryRequest>;

/**
 * Suggest debt edit request
 */
export const SuggestDebtEditRequest = v.object({
  amount: v.optional(v.pipe(v.number(), v.minValue(0.01, 'Amount must be positive'))),
  description: v.optional(v.string()),
  reason: v.pipe(v.string(), v.minLength(5, 'Reason must be at least 5 characters'))
});

export type SuggestDebtEditRequest = v.InferInput<typeof SuggestDebtEditRequest>;

