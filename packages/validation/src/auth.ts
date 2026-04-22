import * as v from 'valibot';

/**
 * Client-safe auth schemas.
 *
 * IMPORTANT:
 * - Do NOT import `@repo/db` or any Drizzle schema here.
 * - These schemas are intended to be safe for browser bundles.
 */

export const passwordSchema = v.pipe(
	v.string(),
	v.minLength(8, 'Password must be at least 8 characters'),
	v.regex(/[A-Z]/, 'Password must contain an uppercase letter'),
	v.regex(/[a-z]/, 'Password must contain a lowercase letter'),
	v.regex(/\d/, 'Password must contain a number'),
	v.regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain a special character')
);

export const emailSchema = v.pipe(v.string(), v.email('Invalid email'));
export const nameSchema = v.pipe(v.string(), v.minLength(2, 'Name must be at least 2 characters'));
export const phoneSchema = v.pipe(
	v.string(),
	v.minLength(10, 'Phone number must be at least 10 digits'),
	v.maxLength(20, 'Phone number is too long')
);

export const signupSchema = v.strictObject({
	name: nameSchema,
	phoneNumber: phoneSchema,
	email: v.optional(emailSchema),
	password: passwordSchema
});

export type SignupInput = v.InferInput<typeof signupSchema>;

export const loginSchema = v.strictObject({
	email: v.pipe(v.string(), v.minLength(1, 'Email or phone is required')),
	password: v.pipe(v.string(), v.minLength(1, 'Password is required'))
});

export const forgotPasswordSchema = v.strictObject({
	email: emailSchema,
	phoneNumber: phoneSchema
});

export const resetPasswordSchema = v.pipe(
	v.strictObject({
		password: passwordSchema,
		confirmPassword: v.string()
	}),
	v.forward(
		v.check((input) => input.password === input.confirmPassword, 'Passwords do not match'),
		['confirmPassword']
	)
);


export const changePasswordSchema = v.pipe(
	v.strictObject({
		currentPassword: v.pipe(v.string(), v.minLength(1, 'Current password is required')),
		newPassword: passwordSchema,
		confirmPassword: v.string()
	}),
	v.forward(
		v.check((input) => input.newPassword === input.confirmPassword, 'Passwords do not match'),
		['confirmPassword']
	)
);

/**
 * OTP Verification Schema
 */
export const verifyOtpSchema = v.strictObject({
	phoneNumber: phoneSchema,
	otp: v.pipe(v.string(), v.length(6, 'OTP must be 6 digits'))
});

/**
 * OTP Resend Schema
 */
export const resendOtpSchema = v.strictObject({
	phoneNumber: phoneSchema
});

export type VerifyOtpInput = v.InferInput<typeof verifyOtpSchema>;
export type ResendOtpInput = v.InferInput<typeof resendOtpSchema>;
