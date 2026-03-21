import { FRONTEND_CONSTANTS } from '@repo/config/frontend';

/**
 * Server-only API URL configuration.
 * Uses direct process.env as fallback for virtual module resolution issues in check.
 */
export const SERVER_API_URL = (globalThis as typeof globalThis & { process?: { env?: Record<string, string> } }).process?.env?.API_URL || FRONTEND_CONSTANTS.API_BASE_URL;
