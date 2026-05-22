import * as v from 'valibot';
import { phoneSchema } from '../auth/auth-primitives.schema';

/**
 * Debt amount schema (number, minimum 1)
 */
export const amountSchema = v.pipe(v.number(), v.minValue(1), v.maxValue(999_999_999_999));

/**
 * Client-side amount schema (string input, validated as formatted number)
 */
export const amountClientSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.regex(/^\d[\d,]*(\.\d+)?$/),
);

/**
 * Description schema
 */
export const descriptionSchema = v.pipe(v.string(), v.minLength(1));

/**
 * Direction schema
 */
export const directionSchema = v.union([v.literal('BORROW'), v.literal('LEND')]);

/**
 * Input schema for creating a debt (Server-side)
 */
export const CreateDebtInputSchema = v.object({
  counterpartyPhone: phoneSchema,
  amount: amountSchema,
  direction: directionSchema,
  description: v.optional(v.string()),
  counterpartyName: v.optional(v.string()),
  dueDate: v.optional(v.union([v.date(), v.string()])),
  status: v.optional(
    v.union([
      v.literal('pending'),
      v.literal('confirmed'),
      v.literal('disputed'),
      v.literal('paid'),
      v.literal('cancelled'),
    ]),
  ),
});

export type CreateDebtInput = v.InferOutput<typeof CreateDebtInputSchema>;

/**
 * Client-side schema for debt creation form
 * Uses string amount for form input
 */
export const CreateDebtClientSchema = v.object({
  ...CreateDebtInputSchema.entries,
  amount: amountClientSchema,
});

export type CreateDebtClientInput = v.InferOutput<typeof CreateDebtClientSchema>;

/**
 * Debt Status Schema
 */
export const debtStatusSchema = v.union([
  v.literal('pending'),
  v.literal('confirmed'),
  v.literal('disputed'),
  v.literal('paid'),
  v.literal('cancelled'),
]);

export type DebtStatus = v.InferOutput<typeof debtStatusSchema>;

/**
 * Debt Direction Schema
 */
export const debtDirectionSchema = v.union([v.literal('LEND'), v.literal('BORROW')]);

export type DebtDirection = v.InferOutput<typeof debtDirectionSchema>;

/**
 * Debt Query Schema (Pagination & Filtering)
 */
export const debtQuerySchema = v.object({
  status: v.optional(debtStatusSchema),
  direction: v.optional(debtDirectionSchema),
  page: v.optional(v.pipe(v.number(), v.minValue(1))),
  limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(1000))),
});

export type DebtQueryInput = v.InferOutput<typeof debtQuerySchema>;

/**
 * Update Debt Status Schema
 */
export const updateDebtStatusSchema = v.object({
  status: v.union([
    v.literal('confirmed'),
    v.literal('disputed'),
    v.literal('paid'),
    v.literal('cancelled'),
  ]),
  notes: v.optional(v.string()),
});

export type UpdateDebtStatusInput = v.InferOutput<typeof updateDebtStatusSchema>;
