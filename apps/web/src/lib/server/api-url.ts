import { API_BASE_URL } from '@repo/config';

/**
 * Server-only API URL configuration.
 * Uses direct process.env as fallback for virtual module resolution issues in check.
 */
export const SERVER_API_URL = (globalThis as any).process?.env?.API_URL || API_BASE_URL;
