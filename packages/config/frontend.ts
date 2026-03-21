/**
 * Frontend Constants - Used only by frontend web app
 */

export const FRONTEND_CONSTANTS = {
  // UI
  TOAST_DURATION_MS: 3000,
  DEBOUNCE_MS: 300,
  ANIMATION_DURATION_MS: 200,
  
  // File Upload
  MAX_IMAGE_FILE_SIZE: 4 * 1024 * 1024, // 4MB
  ACCEPTED_IMAGE_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ] as const,
  
  // API
  API_BASE_URL: 'http://localhost:3000',
  WEB_BASE_URL: 'http://localhost:5173',

  // External Services
  VIETQR_API_URL: 'https://api.vietqr.io/v2/banks',
  VIETQR_TIMEOUT: 5000,
  
  // Storage
  UPLOAD_TMP_DIR: '../../tmp/uploads',
  PROOF_TMP_DIR: '../../tmp/proofs'
} as const;
