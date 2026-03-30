import { SHARED_CONSTANTS } from '../shared';

/**
 * Backend Constants - Used only by backend API
 * 
 * NOTE: Values here are DEFAULTS. Use .env to override them as needed.
 */
export const BACKEND_CONSTANTS = {
  // Job Processing
  JOBS: {
    TIMEOUT_MS: 10 * 60 * 1000, 
    PROGRESS_THROTTLE_MS: SHARED_CONSTANTS.IMPORT.CHUNK_SIZE > 100 ? 1000 : 500
  },

  // Cache TTL
  CACHE: {
    LOCATION_TTL_MS: 60 * 60 * 1000,
    SESSION_TTL_MS: 3 * 60 * 60 * 1000
  },
  
  // Rate Limits
  RATE_LIMITS: {
    FORGOT_PASSWORD: { requests: 5, windowMs: 60 * 60 * 1000 },
    LOGIN: { requests: 10, windowMs: 15 * 60 * 1000 },
    UPLOAD: { requests: 20, windowMs: 60 * 60 * 1000 }
  },
  
  // External Services
  SERVICES: {
    VIETQR_TIMEOUT: 5000,
    NOMINATIM_TIMEOUT: 3000
  },

  // Worker
  WORKER: {
    KILL_TIMEOUT_MS: 5 * 60 * 1000,
    BACKOFF_BASE_MS: 5000,
    BACKOFF_MAX_MS: 60000
  }
} as const;
