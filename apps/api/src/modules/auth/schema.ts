/**
 * Auth Module Schema Definitions
 * 
 * TypeBox definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import { t } from 'elysia';

// Login schema
export const LoginSchema = t.Object({
  identifier: t.String({
    minLength: 1,
    error: 'Email or phone number is required'
  }),
  password: t.String({
    minLength: 8,
    error: 'Password must be at least 8 characters'
  })
});

// Register schema
export const RegisterSchema = t.Object({
  email: t.Optional(t.String({
    format: 'email',
    error: 'Invalid email address'
  })),
  phone: t.String({
    minLength: 10,
    maxLength: 15,
    error: 'Invalid phone number'
  }),
  password: t.String({
    minLength: 8,
    error: 'Password must be at least 8 characters'
  }),
  fullName: t.String({
    minLength: 2,
    error: 'Full name must be at least 2 characters'
  })
});

// Refresh token schema
export const RefreshTokenSchema = t.Object({
  refreshToken: t.String({
    minLength: 1,
    error: 'Refresh token is required'
  })
});

// Logout schema
export const LogoutSchema = t.Object({
  allDevices: t.Optional(t.Boolean())
});

// Verify email schema
export const VerifyEmailSchema = t.Object({
  token: t.String({
    minLength: 1,
    error: 'Verification token is required'
  })
});

// Request password reset schema
export const RequestPasswordResetSchema = t.Object({
  identifier: t.String({
    minLength: 1,
    error: 'Email or phone is required'
  })
});

// Reset password schema
export const ResetPasswordSchema = t.Object({
  token: t.String({
    minLength: 1,
    error: 'Reset token is required'
  }),
  newPassword: t.String({
    minLength: 8,
    error: 'Password must be at least 8 characters'
  })
});

// MFA setup schema
export const MFASetupSchema = t.Object({
  password: t.String({
    minLength: 8,
    error: 'Password is required to enable MFA'
  })
});

// MFA verify schema
export const MFAVerifySchema = t.Object({
  code: t.String({
    minLength: 6,
    maxLength: 6,
    error: 'MFA code must be 6 digits'
  }),
  backupCode: t.Optional(t.String())
});

// Response schemas
export const AuthResponseSchema = t.Object({
  user: t.Object({
    id: t.String(),
    email: t.String(),
    phone: t.Optional(t.String()),
    fullName: t.String(),
    createdAt: t.Date()
  }),
  accessToken: t.String(),
  refreshToken: t.String(),
  expiresIn: t.Number()
});

export const SessionListSchema = t.Object({
  sessions: t.Array(t.Object({
    id: t.String(),
    device: t.String(),
    browser: t.String(),
    os: t.String(),
    ipAddress: t.String(),
    location: t.Optional(t.String()),
    lastActive: t.Date(),
    isCurrent: t.Boolean()
  }))
});
