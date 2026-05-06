import { Type, type Static } from '@sinclair/typebox';
import { phoneSchema } from '../auth/auth-primitives.schema';

/**
 * Debt amount schema (number, minimum 1)
 */
export const amountSchema = Type.Number({ minimum: 1, maximum: 999_999_999_999 });

/**
 * Client-side amount schema (string input, validated as formatted number)
 */
export const amountClientSchema = Type.String({
  minLength: 1,
  pattern: '^\\d[\\d,]*(\\.\\d+)?$',
});

/**
 * Description schema
 */
export const descriptionSchema = Type.String({ minLength: 1 });

/**
 * Direction schema
 */
export const directionSchema = Type.Union([
  Type.Literal('BORROW'),
  Type.Literal('LEND'),
]);

/**
 * Input schema for creating a debt (Server-side)
 */
export const CreateDebtInputSchema = Type.Object({
  counterpartyPhone: phoneSchema,
  amount: amountSchema,
  direction: directionSchema,
  description: Type.Optional(Type.String()),
  counterpartyName: Type.Optional(Type.String()),
  dueDate: Type.Optional(Type.Union([Type.Date(), Type.String()])),
  status: Type.Optional(
    Type.Union([
      Type.Literal('pending'),
      Type.Literal('confirmed'),
      Type.Literal('disputed'),
      Type.Literal('paid'),
      Type.Literal('cancelled'),
    ])
  ),
});

export type CreateDebtInput = Static<typeof CreateDebtInputSchema>;

/**
 * Client-side schema for debt creation form
 * Uses string amount for form input
 */
export const CreateDebtClientSchema = Type.Object({
  ...CreateDebtInputSchema.properties,
  amount: amountClientSchema,
});

export type CreateDebtClientInput = Static<typeof CreateDebtClientSchema>;

/**
 * Debt Status Schema
 */
export const debtStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('confirmed'),
  Type.Literal('disputed'),
  Type.Literal('paid'),
  Type.Literal('cancelled'),
]);

export type DebtStatus = Static<typeof debtStatusSchema>;

/**
 * Debt Direction Schema
 */
export const debtDirectionSchema = Type.Union([
  Type.Literal('LEND'),
  Type.Literal('BORROW'),
]);

export type DebtDirection = Static<typeof debtDirectionSchema>;

/**
 * Debt Query Schema (Pagination & Filtering)
 */
export const debtQuerySchema = Type.Object({
  status: Type.Optional(debtStatusSchema),
  direction: Type.Optional(debtDirectionSchema),
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
});

export type DebtQueryInput = Static<typeof debtQuerySchema>;

/**
 * Update Debt Status Schema
 */
export const updateDebtStatusSchema = Type.Object({
  status: Type.Union([
    Type.Literal('confirmed'),
    Type.Literal('disputed'),
    Type.Literal('paid'),
    Type.Literal('cancelled'),
  ]),
  notes: Type.Optional(Type.String()),
});

export type UpdateDebtStatusInput = Static<typeof updateDebtStatusSchema>;
