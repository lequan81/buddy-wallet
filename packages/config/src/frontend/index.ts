import { env } from '../env';

/**
 * Frontend-safe configuration constants.
 */
export const FRONTEND_CONSTANTS = {
	TOAST_DURATION_MS: env.int('VITE_TOAST_DURATION_MS', 3000),
	ANIMATION_DURATION_MS: env.int('VITE_ANIMATION_DURATION_MS', 200),
	MAX_UPLOAD_SIZE_MB: env.int('VITE_MAX_UPLOAD_SIZE_MB', 5),
	AUTH_TIMEOUT_MS: env.int('VITE_AUTH_TIMEOUT_MS', 3500),
	API_BASE_URL: env.string('VITE_API_URL', 'http://localhost:3000'),
	VIETQR_API_URL: env.string('VITE_VIETQR_API_URL', 'https://api.vietqr.io/v2/banks'),
	VIETQR_TIMEOUT: env.int('VITE_VIETQR_TIMEOUT_MS', 5000)
} as const;
