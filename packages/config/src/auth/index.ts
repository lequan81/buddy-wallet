import { SHARED_CONSTANTS } from '../shared';

/**
 * Authentication & Security Constants
 */
export const AUTH_CONSTANTS = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
  SESSION_TIMEOUT_MS: 15 * 60 * 1000,
  REFRESH_TOKEN_DAYS: 90,
  MIN_PASSWORD_LENGTH: SHARED_CONSTANTS.USER.PASSWORD_MIN_LENGTH,
  TIMEOUT_MS: 3500,

  // OTP Configuration
  OTP: {
    EXPIRY_MINUTES: 10,
    RESEND_COOLDOWN_SECONDS: 60,
    MAX_RESENDS_PER_HOUR: 5,
    MAX_ATTEMPTS: 5
  },

  // Password Hashing
  ARGON2: {
    ALGORITHM: 'argon2id' as const,
    MEMORY_COST: 65536,
    TIME_COST: 3
  }
} as const;
