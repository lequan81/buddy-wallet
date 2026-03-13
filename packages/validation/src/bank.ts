import * as v from 'valibot';

export const accountNumberSchema = v.pipe(
  v.string(),
  v.minLength(6, 'Account number must be at least 6 digits'),
  v.regex(/^\d+$/, 'Account number must contain only digits')
);

export const accountNameSchema = v.pipe(
  v.string(),
  v.minLength(3, 'Account name must be at least 3 characters'),
  v.transform((val) => val.toUpperCase())
);
