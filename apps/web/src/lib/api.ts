/**
 * Global API Configuration & Helpers
 * Centralizes all API-related settings and utilities
 */

import { API_BASE_URL, WEB_BASE_URL } from '@repo/config';

// Environment-based URLs (works in both SSR and client)
export const API_URL = import.meta.env.VITE_API_URL || API_BASE_URL;
export const WEB_URL = import.meta.env.VITE_WEB_URL || WEB_BASE_URL;

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

// Track ongoing refresh to prevent multiple simultaneous refreshes
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh the access token using the refresh token
 * Returns true if refresh succeeded, false otherwise
 */
async function refreshAccessToken(): Promise<boolean> {
	// If a refresh is already in progress, wait for it
	if (refreshPromise) {
		return refreshPromise;
	}

	refreshPromise = (async () => {
		try {
			const response = await fetch(`${API_URL}/v1/auth/refresh`, {
				method: 'POST',
				credentials: 'include', // Send refresh_token cookie
				headers: getDefaultHeaders()
			});

			if (response.ok) {
				// Refresh successful - new cookies are automatically set by browser
				console.log('[Auth] Token refreshed successfully');
				return true;
			}

			// Refresh failed - probably expired refresh token
			console.warn('[Auth] Token refresh failed:', response.status);
			return false;
		} catch (error) {
			console.error('[Auth] Refresh error:', error);
			return false;
		} finally {
			// Clear the promise so future refreshes can proceed
			refreshPromise = null;
		}
	})();

	return refreshPromise;
}

/**
 * Fetch wrapper with default configuration and auto-refresh
 * Use this for client-side API calls
 *
 * SECURITY: Automatically refreshes token on 401 errors
 */
export async function apiFetch<T>(
	endpoint: string,
	options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; response: Response }> {
	if (!endpoint) {
		console.error('[API] Empty endpoint requested');
		return {
			data: null,
			error: 'Empty endpoint',
			response: new Response(null, { status: 400 })
		};
	}
	const url = `${API_URL}${endpoint}`;

	// Don't retry refresh endpoint itself to avoid infinite loops
	const isRefreshEndpoint = endpoint.includes('/auth/refresh');

	const isRetry = (options as unknown as { _isRetry?: boolean })._isRetry === true;

	try {
		const response = await fetch(url, {
			...defaultFetchOptions,
			...options,
			headers: {
				...getDefaultHeaders(),
				...options.headers
			}
		});

		// SECURITY: Auto-refresh on 401 Unauthorized (token expired)
		if (response.status === 401 && !isRefreshEndpoint && !isRetry) {
			console.log('[Auth] 401 detected, attempting token refresh...');

			const refreshSuccess = await refreshAccessToken();

			if (refreshSuccess) {
				// Retry the original request with the new token
				console.log('[Auth] Retrying original request with new token');
				return apiFetch<T>(endpoint, {
					...options,
					_isRetry: true // Prevent infinite retry loops
				} as RequestInit & { _isRetry: boolean });
			} else {
				// Refresh failed - redirect to login
				console.log('[Auth] Refresh failed, redirecting to login');
				if (typeof window !== 'undefined') {
					window.location.href = `/login?redirectTo=${encodeURIComponent(window.location.pathname)}`;
				}

				return {
					data: null,
					error: 'Session expired. Please login again.',
					response
				};
			}
		}

		const data = await response.json().catch(() => null);

		if (!response.ok) {
			return {
				data: null,
				error: data?.message || data?.error || `HTTP ${response.status}`,
				response
			};
		}

		// Auto-unwrap standardized API response format: { success: true, data: ... }
		if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
			return { data: data.data, error: null, response };
		}

		return { data, error: null, response };
	} catch (err) {
		return {
			data: null,
			error: err instanceof Error ? err.message : 'Network error',
			response: new Response(null, { status: 0 })
		};
	}
}

/**
 * Server-side fetch wrapper (for use in +page.server.ts, hooks.server.ts)
 * Forwards cookies and adds required headers
 */
export async function serverFetch<T>(
	endpoint: string,
	options: RequestInit & { cookies?: string; token?: string } = {}
): Promise<{ data: T | null; error: string | null; response: Response }> {
	const { cookies, token, ...fetchOptions } = options;
	const url = `${API_URL}${endpoint}`;

	try {
		const response = await fetch(url, {
			...fetchOptions,
			headers: {
				...getDefaultHeaders(),
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...(cookies ? { Cookie: cookies } : {}),
				...fetchOptions.headers
			}
		});

		const data = await response.json().catch(() => null);

		if (!response.ok) {
			return {
				data: null,
				error: data?.message || data?.error || `HTTP ${response.status}`,
				response
			};
		}

		// Auto-unwrap standardized API response format: { success: true, data: ... }
		// This prevents callers from needing to do response.data.data
		if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
			return { data: data.data, error: null, response };
		}

		return { data, error: null, response };
	} catch (err) {
		return {
			data: null,
			error: err instanceof Error ? err.message : 'Network error',
			response: new Response(null, { status: 0 })
		};
	}
}

/**
 * Check if a phone number has pending debts (public endpoint)
 * No authentication required
 */
export async function checkDebtByPhone(phoneNumber: string): Promise<{
	data: {
		success: boolean;
		phone: string;
		found: boolean;
		count: number;
	} | null;
	error: string | null;
}> {
	try {
		const params = new URLSearchParams({ phoneNumber });
		const url = `${API_URL}/v1/public/check-debt?${params}`;

		const response = await fetch(url, {
			method: 'GET',
			headers: getDefaultHeaders()
		});

		const data = await response.json().catch(() => null);

		if (!response.ok) {
			return {
				data: null,
				error: data?.message || data?.error || 'Failed to check debt status'
			};
		}

		return { data, error: null };
	} catch (err) {
		return {
			data: null,
			error: err instanceof Error ? err.message : 'Network error'
		};
	}
}
