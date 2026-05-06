import { Type, type Static } from '@sinclair/typebox';

export const createDebtRequestSchema = Type.Object({
  amount: Type.Number({ minimum: 1 }),
  description: Type.String({ maxLength: 500 }),
  counterpartyPhone: Type.String({ minLength: 9, maxLength: 20 }),
  direction: Type.Union([Type.Literal('BORROW'), Type.Literal('LEND')]),
  expiryOption: Type.Optional(Type.Union([Type.Literal('never'), Type.Literal('7d'), Type.Literal('30d'), Type.Literal('90d')])),
  confirmDuplicate: Type.Optional(Type.Boolean())
});

export type CreateDebtRequest = Static<typeof createDebtRequestSchema>;

// Aliases for controller imports
export const CreateDebtSchema = createDebtRequestSchema;
export type CreateDebtSchema = CreateDebtRequest;
