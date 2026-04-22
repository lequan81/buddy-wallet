/**
 * Authentication Request DTOs
 *
 * Centralized validation using shared schemas from @repo/validation.
 * Per Laravel convention, this is located in app/Http/Requests/
 */
import * as v from 'valibot';
import { 
  signupSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  verifyOtpSchema,
  resendOtpSchema
} from '@repo/validation';

/**
 * Register Request Schema
 */
export const RegisterRequest = signupSchema;
export type RegisterRequest = v.InferInput<typeof RegisterRequest>;

/**
 * Login Request Schema
 */
export const LoginRequest = v.intersect([
  loginSchema,
  v.object({
    rememberMe: v.optional(v.boolean(), false)
  })
]);
export type LoginRequest = v.InferInput<typeof LoginRequest>;

/**
 * Verify OTP Request
 */
export const VerifyOTPRequest = verifyOtpSchema;
export type VerifyOTPRequest = v.InferInput<typeof VerifyOTPRequest>;

/**
 * Resend OTP Request
 */
export const ResendOTPRequest = resendOtpSchema;
export type ResendOTPRequest = v.InferInput<typeof ResendOTPRequest>;
