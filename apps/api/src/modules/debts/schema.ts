/**
 * Debts Module Schema Definitions
 * 
 * Valibot definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import * as v from 'valibot';

// Create debt schema
export const CreateDebtSchema = v.object({
  debtorId: v.pipe(v.string(), v.uuid()),
  amount: v.pipe(v.number(), v.minValue(1)),
  currency: v.pipe(v.string(), v.minLength(3), v.maxLength(3)),
  description: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(500))),
  dueDate: v.optional(v.date())
});

// Update debt schema
export const UpdateDebtSchema = v.object({
  amount: v.optional(v.pipe(v.number(), v.minValue(1))),
  currency: v.optional(v.pipe(v.string(), v.minLength(3), v.maxLength(3))),
  description: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(500))),
  dueDate: v.optional(v.date())
});

// Debt status schema
export const DebtStatusSchema = v.object({
  status: v.picklist(['pending', 'confirmed', 'cancelled', 'paid'])
});

// Cancel debt schema
export const CancelDebtSchema = v.object({
  reason: v.optional(v.pipe(v.string(), v.maxLength(500)))
});

// Confirm debt schema
export const ConfirmDebtSchema = v.object({
  proofImageId: v.optional(v.string())
});

// Batch delete schema
export const BatchDeleteSchema = v.object({
  ids: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.minLength(1))
});

// Delete all schema
export const DeleteAllQuerySchema = v.object({
  confirm: v.literal('true')
});

// List debts query schema
export const ListDebtsQuerySchema = v.object({
  status: v.optional(v.picklist(['pending', 'confirmed', 'paid', 'disputed', 'cancelled'])),
  direction: v.optional(v.picklist(['LEND', 'BORROW'])),
  sortBy: v.optional(v.picklist(['createdAt', 'amount', 'status', 'updatedAt'])),
  sortOrder: v.optional(v.picklist(['asc', 'desc'])),
  page: v.optional(v.pipe(v.number(), v.minValue(1))),
  limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100)))
});

// Suggest edit schema
export const SuggestEditSchema = v.object({
  amount: v.optional(v.pipe(v.number(), v.minValue(1))),
  description: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(500)))
});

// Respond to suggestion schema
export const RespondSuggestionSchema = v.object({
  accept: v.boolean()
});

// Response schemas
export const DebtResponseSchema = v.object({
  id: v.string(),
  amount: v.number(),
  currency: v.string(),
  debtorId: v.string(),
  creditorId: v.string(),
  status: v.string(),
  description: v.optional(v.string()),
  dueDate: v.optional(v.date()),
  createdAt: v.date(),
  updatedAt: v.optional(v.date())
});

export const DebtListResponseSchema = v.object({
  data: v.array(DebtResponseSchema),
  meta: v.object({
    total: v.number(),
    page: v.number(),
    limit: v.number(),
    totalPages: v.number()
  })
});
