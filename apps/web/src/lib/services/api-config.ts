/**
 * Shared API configuration and header builders.
 *
 * This module exists to avoid circular imports between client helpers.
 */

// Environment-based URLs (works in both SSR and client)
export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
export const WEB_URL = import.meta.env.VITE_WEB_URL || 'http://localhost:5173';

/**
 * Default headers required for all API requests.
 */
export const getDefaultHeaders = (): HeadersInit => ({
	Origin: WEB_URL,
	Referer: `${WEB_URL}/`
});

/**
 * Create headers with authentication token.
 */
export const getAuthHeaders = (token?: string): HeadersInit => ({
	...getDefaultHeaders(),
	...(token ? { Authorization: `Bearer ${token}` } : {})
});

/**
 * Create headers for server-side requests with cookies.
 */
export const getServerHeaders = (cookies: string): HeadersInit => ({
	...getDefaultHeaders(),
	Cookie: cookies
});
