import { Type, type Static } from '@sinclair/typebox';

/**
 * Frontend-safe auth primitive schemas (TypeBox equivalents of valibot schemas)
 * These are used for client-side form validation via validateField()
 */

export const passwordSchema = Type.String({
  minLength: 8,
  pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$',
});

export const emailSchema = Type.String({ format: 'email' });

export const nameSchema = Type.String({ minLength: 2 });

export const phoneSchema = Type.String({ minLength: 10, maxLength: 20 });

export type Password = Static<typeof passwordSchema>;
export type Email = Static<typeof emailSchema>;
export type Name = Static<typeof nameSchema>;
export type Phone = Static<typeof phoneSchema>;
