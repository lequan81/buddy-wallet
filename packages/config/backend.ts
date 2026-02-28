/**
 * Backend Constants - Used only by backend API
 */

export const BACKEND_CONSTANTS = {
  // Import Processing
  PREVIEW_ROWS: 5,
  MAX_EMPTY_ROWS: 20,
  CHUNK_SIZE: 200,
  STALE_LOG_LIFETIME: 24 * 60 * 60 * 1000, // 24 hours
  UPLOAD_EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours
  MAX_ROWS: 10000, // Add missing MAX_ROWS
  
  // Authentication
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  SESSION_TIMEOUT_MS: 15 * 60 * 1000, // 15 minutes
  REFRESH_TOKEN_DAYS: 90,
  PASSWORD_MIN_LENGTH: 8,
  AUTH_TIMEOUT_MS: 3500,
  
  // Cache TTL
  LOCATION_TTL_MS: 60 * 60 * 1000, // 1 hour
  SESSION_TTL_MS: 3 * 60 * 60 * 1000, // 3 hours
  
  // Rate Limits
  FORGOT_PASSWORD: { requests: 5, windowMs: 60 * 60 * 1000 }, // 5/hour
  LOGIN: { requests: 10, windowMs: 15 * 60 * 1000 }, // 10/15min
  UPLOAD: { requests: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
  
  // Database
  MAX_DIRECT_PROCESS_SIZE_BYTES: 200 * 1024, // 200KB
  
  // External Services
  VIETQR_TIMEOUT: 5000,
  NOMINATIM_TIMEOUT: 3000
} as const;
