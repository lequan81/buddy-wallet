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
  ClientLocation
} from '@repo/types';

/** Result of OTP creation for email verification */
export interface CreateOtpResult {
  success: boolean;
  otp?: string;
  error?: string;
}

/** Result of OTP verification */
export interface VerifyOtpResult {
  success: boolean;
  error?: string;
}

/** Result of OTP resend with optional rate-limit info */
export interface ResendOtpResult {
  success: boolean;
  otp?: string;
  error?: string;
  retryAfter?: number; // seconds until next resend allowed
}
