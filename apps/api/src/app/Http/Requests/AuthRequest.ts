/**
 * Authentication Request DTOs
 *
 * Validation schemas for authentication endpoints.
 */

import { z } from 'zod';

/**
 * Register request body
 */
export const RegisterRequest = z.object({
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export type RegisterRequest = z.infer<typeof RegisterRequest>;

/**
 * Login request body
 */
export const LoginRequest = z.object({
  phoneNumber: z.string().min(10, 'Invalid phone number'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false)
});

export type LoginRequest = z.infer<typeof LoginRequest>;

/**
 * Verify OTP request
 */
export const VerifyOTPRequest = z.object({
  phoneNumber: z.string(),
  otp: z.string().length(6, 'OTP must be 6 digits')
});

export type VerifyOTPRequest = z.infer<typeof VerifyOTPRequest>;

/**
 * Resend OTP request
 */
export const ResendOTPRequest = z.object({
  phoneNumber: z.string().min(10, 'Invalid phone number')
});

export type ResendOTPRequest = z.infer<typeof ResendOTPRequest>;
