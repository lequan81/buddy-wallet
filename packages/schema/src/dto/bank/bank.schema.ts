import * as v from 'valibot';

/**
 * Bank account number schema — digits only, min 6 characters
 */
export const accountNumberSchema = v.pipe(
  v.string(),
  v.minLength(6),
  v.regex(/^\d+$/),
);

/**
 * Bank account name schema — min 3 characters
 */
export const accountNameSchema = v.pipe(v.string(), v.minLength(3));

export const bankAccountSchema = v.object({
  id: v.optional(v.string()),
  bankCode: v.pipe(v.string(), v.minLength(1)),
  bankName: v.pipe(v.string(), v.minLength(1)),
  bankBin: v.pipe(v.string(), v.minLength(1)),
  accountNumber: accountNumberSchema,
  accountName: accountNameSchema,
  isDefault: v.optional(v.boolean()),
});

export type AccountNumber = v.InferOutput<typeof accountNumberSchema>;
export type AccountName = v.InferOutput<typeof accountNameSchema>;
export type BankAccountRequest = v.InferOutput<typeof bankAccountSchema>;
