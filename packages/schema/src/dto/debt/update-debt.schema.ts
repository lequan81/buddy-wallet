import * as v from 'valibot';

export const updateDebtRequestSchema = v.object({
  description: v.pipe(v.string(), v.maxLength(500)),
  amount: v.pipe(v.number(), v.minValue(1)),
});

export type UpdateDebtRequest = v.InferOutput<typeof updateDebtRequestSchema>;

export const suggestEditRequestSchema = v.object({
  description: v.pipe(v.string(), v.maxLength(500)),
  amount: v.pipe(v.number(), v.minValue(1)),
  note: v.optional(v.pipe(v.string(), v.maxLength(200))),
});

export type SuggestEditRequest = v.InferOutput<typeof suggestEditRequestSchema>;
