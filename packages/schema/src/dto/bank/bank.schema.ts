import { Type, type Static } from '@sinclair/typebox';

/**
 * Bank account number schema — digits only, min 6 characters
 */
export const accountNumberSchema = Type.String({
  minLength: 6,
  pattern: '^\\d+$',
});

/**
 * Bank account name schema — min 3 characters
 */
export const accountNameSchema = Type.String({
  minLength: 3,
});

export type AccountNumber = Static<typeof accountNumberSchema>;
export type AccountName = Static<typeof accountNameSchema>;
