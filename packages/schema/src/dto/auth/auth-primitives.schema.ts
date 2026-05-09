import * as v from 'valibot';

/**
 * Frontend-safe auth primitive schemas (Valibot)
 * These are used for client-side form validation via validateField()
 */

export const passwordSchema = v.pipe(
  v.string(),
  v.minLength(8),
  v.regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/,
  ),
);

export const emailSchema = v.pipe(v.string(), v.email());

export const nameSchema = v.pipe(v.string(), v.minLength(2));

export const phoneSchema = v.pipe(v.string(), v.minLength(10), v.maxLength(20));

export type Password = v.InferOutput<typeof passwordSchema>;
export type Email = v.InferOutput<typeof emailSchema>;
export type Name = v.InferOutput<typeof nameSchema>;
export type Phone = v.InferOutput<typeof phoneSchema>;
