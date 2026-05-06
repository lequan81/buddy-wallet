import { Type, type Static } from '@sinclair/typebox';
import { passwordSchema, emailSchema, phoneSchema } from './auth-primitives.schema';

/**
 * Change Password Schema
 */
export const changePasswordSchema = Type.Object({
  currentPassword: Type.String({ minLength: 1 }),
  newPassword: passwordSchema,
  confirmPassword: Type.String({ minLength: 1 }),
});

export type ChangePasswordRequest = Static<typeof changePasswordSchema>;

/**
 * Forgot Password Schema
 */
export const forgotPasswordSchema = Type.Object({
  email: emailSchema,
  phoneNumber: phoneSchema,
});

export type ForgotPasswordRequest = Static<typeof forgotPasswordSchema>;

/**
 * Reset Password Schema
 */
export const resetPasswordSchema = Type.Object({
  password: passwordSchema,
  confirmPassword: Type.String({ minLength: 1 }),
});

export type ResetPasswordRequest = Static<typeof resetPasswordSchema>;
