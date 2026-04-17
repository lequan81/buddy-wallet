/**
 * Auth Type Definitions
 * Re-exported from @repo/types + email verification types
 */
export type {
  RegisterInput,
  LoginInput,
  AuthResult,
  RefreshSessionResult,
  JwtService,
  RequestInfo,
  ClientHints,
  ClientLocation,
  Result
} from '@repo/types';

/** Result of OTP creation for email verification */
export type CreateOtpResult = Result<{ otp: string }>;

/** Result of OTP verification */
export type VerifyOtpResult = Result<void>;

/** Result of OTP resend with optional rate-limit info */
export type ResendOtpResult = Result<{ otp?: string; retryAfter?: number }>;

/** Result of password reset operations */
export type ResetResult = Result<void>;

/** Authenticated user from session context */
export interface AuthUser {
  id: string;
  email?: string | null;
  emailVerified?: boolean;
  phoneNumber: string;
  role: string;
  name?: string;
}
