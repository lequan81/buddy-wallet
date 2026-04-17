/**
 * Debt Request DTOs
 *
 * Validation schemas for debt endpoints.
 */

import { z } from 'zod';

/**
 * Create debt request
 */
export const CreateDebtRequest = z.object({
  debtorPhone: z.string().min(10, 'Invalid debtor phone number'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters (e.g., USD)'),
  description: z.string().optional(),
  expiryOption: z.enum(['never', '7d', '30d', '90d']).default('never')
});

export type CreateDebtRequest = z.infer<typeof CreateDebtRequest>;

/**
 * Update debt status request
 */
export const UpdateDebtStatusRequest = z.object({
  status: z.enum(['confirmed', 'disputed', 'paid', 'cancelled']),
  notes: z.string().optional()
});

export type UpdateDebtStatusRequest = z.infer<typeof UpdateDebtStatusRequest>;

/**
 * Debt query parameters
 */
export const DebtQueryRequest = z.object({
  status: z.enum(['pending', 'confirmed', 'disputed', 'paid', 'cancelled']).optional(),
  direction: z.enum(['owed', 'owing']).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
});

export type DebtQueryRequest = z.infer<typeof DebtQueryRequest>;

/**
 * Suggest debt edit request
 */
export const SuggestDebtEditRequest = z.object({
  amount: z.number().positive().optional(),
  description: z.string().optional(),
  reason: z.string().min(5, 'Reason must be at least 5 characters')
});

export type SuggestDebtEditRequest = z.infer<typeof SuggestDebtEditRequest>;
