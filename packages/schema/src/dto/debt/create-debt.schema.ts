import * as v from 'valibot';

export const createDebtRequestSchema = v.object({
  amount: v.pipe(v.number(), v.minValue(1)),
  description: v.pipe(v.string(), v.maxLength(500)),
  counterpartyPhone: v.pipe(v.string(), v.minLength(9), v.maxLength(20)),
  direction: v.union([v.literal('BORROW'), v.literal('LEND')]),
  expiryOption: v.optional(
    v.union([v.literal('never'), v.literal('7d'), v.literal('30d'), v.literal('90d')]),
  ),
  confirmDuplicate: v.optional(v.boolean()),
});

export type CreateDebtRequest = v.InferOutput<typeof createDebtRequestSchema>;

// Aliases for controller imports
export const CreateDebtSchema = createDebtRequestSchema;
export type CreateDebtSchema = CreateDebtRequest;
