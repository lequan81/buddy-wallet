/**
 * Auth Module Schema Definitions
 * 
 * Valibot definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import * as v from 'valibot';

// Login schema
export const LoginSchema = v.object({
  identifier: v.pipe(v.string(), v.minLength(1)),
  password: v.pipe(v.string(), v.minLength(8))
});

// Register schema
export const RegisterSchema = v.object({
  email: v.optional(v.pipe(v.string(), v.email())),
  phone: v.pipe(v.string(), v.minLength(10), v.maxLength(15)),
  password: v.pipe(v.string(), v.minLength(8)),
  fullName: v.pipe(v.string(), v.minLength(2))
});

// Refresh token schema — optional so client can send cookie-only refresh
export const RefreshTokenSchema = v.object({
  refreshToken: v.optional(v.pipe(v.string(), v.minLength(1)))
});

// Logout schema
export const LogoutSchema = v.object({
  allDevices: v.optional(v.boolean())
});

// Verify email schema
export const VerifyEmailSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1))
});

// Request password reset schema
export const RequestPasswordResetSchema = v.object({
  identifier: v.pipe(v.string(), v.minLength(1))
});

// Reset password schema
export const ResetPasswordSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
  newPassword: v.pipe(v.string(), v.minLength(8))
});

// MFA setup schema
export const MFASetupSchema = v.object({
  password: v.pipe(v.string(), v.minLength(8))
});

// MFA verify schema
export const MFAVerifySchema = v.object({
  code: v.pipe(v.string(), v.minLength(6), v.maxLength(6)),
  backupCode: v.optional(v.string())
});

// Response schemas
export const AuthResponseSchema = v.object({
  user: v.object({
    id: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    fullName: v.string(),
    createdAt: v.date()
  }),
  accessToken: v.string(),
  refreshToken: v.string(),
  expiresIn: v.number()
});

export const SessionListSchema = v.object({
  sessions: v.array(v.object({
    id: v.string(),
    device: v.string(),
    browser: v.string(),
    os: v.string(),
    ipAddress: v.string(),
    location: v.optional(v.string()),
    lastActive: v.date(),
    isCurrent: v.boolean()
  }))
});
