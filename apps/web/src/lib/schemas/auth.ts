/**
 * Client-safe auth validation schemas.
 *
 * These schemas use only valibot and are safe for browser bundles.
 * They do NOT import any server-only packages (@repo/db, etc.)
 */
import * as v from 'valibot';

export const signupSchema = v.object({
	name: v.pipe(v.string(), v.minLength(2, 'Name must be at least 2 characters')),
	phoneNumber: v.pipe(
		v.string(),
		v.minLength(10, 'Phone number must be at least 10 digits'),
		v.maxLength(20, 'Phone number is too long')
	),
	email: v.optional(v.pipe(v.string(), v.email('Invalid email'))),
	password: v.pipe(
		v.string(),
		v.minLength(8, 'Password must be at least 8 characters'),
		v.regex(/[A-Z]/, 'Password must contain an uppercase letter'),
		v.regex(/[a-z]/, 'Password must contain a lowercase letter'),
		v.regex(/\d/, 'Password must contain a number'),
		v.regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain a special character')
	)
});

export type SignupInput = v.InferInput<typeof signupSchema>;
