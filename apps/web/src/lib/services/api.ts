/**
 * Global API Configuration & Helpers
 * Centralizes all API-related settings and utilities
 */

import { FRONTEND_CONSTANTS } from '@repo/config/frontend';
import { treaty } from '@elysiajs/eden';
import type { App } from '@repo/api';

// Environment-based URLs (works in both SSR and client)
export const API_URL = import.meta.env.VITE_API_URL || FRONTEND_CONSTANTS.API_BASE_URL;
export const WEB_URL = import.meta.env.VITE_WEB_URL || FRONTEND_CONSTANTS.WEB_BASE_URL;

/**
 * Default headers required for all API requests
 * - Origin/Referer: Required by CSRF protection
 * - Content-Type: Standard JSON API
 */
export const getDefaultHeaders = (): HeadersInit => ({
	'Content-Type': 'application/json',
	Origin: WEB_URL,
	Referer: `${WEB_URL}/`
});

/**
 * Create headers with authentication token
 */
export const getAuthHeaders = (token?: string): HeadersInit => ({
	...getDefaultHeaders(),
	...(token ? { Authorization: `Bearer ${token}` } : {})
});

/**
 * Create headers for server-side requests with cookies
 */
export const getServerHeaders = (cookies: string): HeadersInit => ({
	...getDefaultHeaders(),
	Cookie: cookies
});

/**
 * Default fetch options for API calls
 */
export const defaultFetchOptions: RequestInit = {
	credentials: 'include', // Always send cookies
	headers: getDefaultHeaders()
};

/**
 * Safely parse JSON from a Response, returning null on parse errors
 * Handles cases where the server returns non-JSON (e.g., error strings)
 */
export async function safeJsonParse<T>(response: Response): Promise<T | null> {
	try {
		const text = await response.text();
		if (!text) return null;

		// Check if it looks like JSON before parsing
		const trimmed = text.trim();
		if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
			console.error('[API] Received non-JSON response:', trimmed.slice(0, 100));
			return null;
		}

		return JSON.parse(text) as T;
	} catch (error) {
		console.error('[API] JSON parse failed:', error);
		return null;
	}
}

// Shared refresh logic — single source of truth (prevents dual refresh races)
import { refreshAccessToken } from './auth-refresh';

/**
 * Create a Treaty client with auto-refresh support
 *
 * SECURITY: Automatically refreshes token on 401 errors
 */
export const createTreatyClient = (
	fetcher?: typeof fetch,
	token?: string,
	cookies?: string,
	options?: { autoRefresh?: boolean }
) => {
	const originalFetcher = fetcher || fetch;
	const autoRefreshEnabled = options?.autoRefresh !== false;

	// Custom fetcher with auto-refresh
	const autoRefreshFetcher = async (
		input: RequestInfo | URL,
		init?: RequestInit
	): Promise<Response> => {
		const response = await originalFetcher(input, init);

		// Auto-refresh on 401 (except for refresh endpoint itself)
		const urlString =
			typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		const isRefreshEndpoint = urlString.includes('/auth/refresh');

		if (response.status === 401 && !isRefreshEndpoint) {
			console.log('[Eden] 401 detected, attempting token refresh...');

			const refreshSuccess = await refreshAccessToken(originalFetcher, cookies);

			if (refreshSuccess) {
				// Retry the original request
				console.log('[Eden] Retrying with new token');
				return originalFetcher(input, init);
			} else {
				// Refresh failed - redirect to login
				console.log('[Eden] Refresh failed, redirecting to login');
				if (typeof window !== 'undefined') {
					window.location.href = `/login?redirectTo=${encodeURIComponent(window.location.pathname)}`;
				}
			}
		}

		return response;
	};


	const activeFetcher = autoRefreshEnabled ? autoRefreshFetcher : originalFetcher;

	return treaty<App>(API_URL, {
		fetcher: activeFetcher as typeof fetch,
		fetch: {
			credentials: 'include' // Send cookies with cross-origin requests
		},
		headers: {
			...getDefaultHeaders(), // Always include Origin/Referer for CSRF
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(cookies ? { Cookie: cookies } : {})
		}
	});
};

/**
 * Unified EdenTreaty API client for client-side usage
 */
export const api = createTreatyClient();
