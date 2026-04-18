import * as v from 'valibot';

export const createDebtRequestSchema = v.object({
  amount: v.pipe(v.number(), v.minValue(1, 'amount must be greater than 0')),
  description: v.pipe(v.string(), v.maxLength(500, 'description too long')),
  counterpartyPhone: v.pipe(v.string(), v.minLength(9, 'counterpartyPhone is too short'), v.maxLength(20, 'counterpartyPhone is too long')),
  direction: v.picklist(['BORROW', 'LEND']),
  expiryOption: v.optional(v.picklist(['never', '7d', '30d', '90d'])),
  confirmDuplicate: v.optional(v.boolean())
});

export type CreateDebtRequest = v.InferOutput<typeof createDebtRequestSchema>;

// Aliases for controller imports
export const CreateDebtSchema = createDebtRequestSchema;
export type CreateDebtSchema = CreateDebtRequest;
