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

/**
 * MFA Status Definitions
 */

export interface MFASetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAVerifyResult {
  success: boolean;
  validBackupCode?: boolean;
}

export interface MFAStatus {
  enabled: boolean;
  method: 'totp' | null;
  lastVerifiedAt: Date | null;
}

/**
 * Extended User type with MFA fields
 */
import type { User } from '@repo/db';
export interface UserMFA extends User {
  mfaSecret?: string | null;
  mfaBackupCodes?: string[] | null;
  mfaEnabled?: boolean;
  mfaMethod?: 'totp' | null;
  mfaSetupAt?: Date | null;
  mfaLastVerifiedAt?: Date | null;
}

/**
 * Rate Limiting Definitions
 */
export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** Authenticated user from session context */
export interface AuthUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string;
  role: string;
  name: string;
  permissions: string[];
}

