import * as v from 'valibot';
import { passwordSchema, emailSchema, phoneSchema } from './auth-primitives.schema';

/**
 * Change Password Schema
 */
export const changePasswordSchema = v.object({
  currentPassword: v.pipe(v.string(), v.minLength(1)),
  newPassword: passwordSchema,
  confirmPassword: v.pipe(v.string(), v.minLength(1)),
});

export type ChangePasswordRequest = v.InferOutput<typeof changePasswordSchema>;

/**
 * Forgot Password Schema
 */
export const forgotPasswordSchema = v.object({
  email: emailSchema,
  phoneNumber: phoneSchema,
});

export type ForgotPasswordRequest = v.InferOutput<typeof forgotPasswordSchema>;

/**
 * Reset Password Schema
 */
export const resetPasswordSchema = v.object({
  password: passwordSchema,
  confirmPassword: v.pipe(v.string(), v.minLength(1)),
});

export type ResetPasswordRequest = v.InferOutput<typeof resetPasswordSchema>;
