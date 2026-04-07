/**
 * Global API Configuration & Helpers
 * Centralizes all API-related settings and utilities
 */

import { treaty } from '@elysiajs/eden';
import type { App } from '@repo/api';
import type { ApiResponse } from '@repo/errors';

// Environment-based URLs (works in both SSR and client)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const WEB_URL = import.meta.env.VITE_WEB_URL || 'http://localhost:5173';

/**
 * Default headers required for all API requests
 */
export const getDefaultHeaders = (): HeadersInit => ({
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

// --- Type Flattening Utilities ---

/**
 * Map an ApiResponse<T> to T by unwrapping it.
 */
type MapApiResponse<T> = T extends ApiResponse<infer R> ? R : T;

/**
 * Recursive type that unwraps ApiResponse envelopes from Eden Treaty results.
 * This ensures that the frontend sees 'data.user' instead of 'data.data.user'.
 */
type FlattenTreaty<T> = T extends (...args: infer Args) => infer R
	? (...args: Args) => FlattenTreaty<R>
	: T extends Promise<infer R>
	? Promise<FlattenTreaty<R>>
	: T extends { data: infer D; error: infer E; status: infer S; response: infer Res }
	? { data: MapApiResponse<D>; error: E; status: S; response: Res }
	: T extends object
	? { [K in keyof T]: FlattenTreaty<T[K]> }
	: T;

// Shared refresh logic — single source of truth (prevents dual refresh races)
import { refreshAccessToken } from './auth-refresh';

/**
 * Create a Treaty client with auto-refresh support and response flattening.
 *
 * This version automatically unwraps { success: true, data: T } into T.
 */
export const createTreatyClient = (
	fetcher?: typeof fetch,
	token?: string,
	cookies?: string,
	options?: { autoRefresh?: boolean }
) => {
	const originalFetcher = fetcher || fetch;
	const autoRefreshEnabled = options?.autoRefresh !== false;

	/**
	 * Custom fetcher that:
	 * 1. Handles token refresh on 401
	 * 2. Unwraps the standardized API { success, data } envelope
	 */
	const customFetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		let response = await originalFetcher(input, init);

		// 1. Auto-refresh on 401
		const urlString =
			typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		const isRefreshEndpoint = urlString.includes('/auth/refresh');

		if (response.status === 401 && !isRefreshEndpoint && autoRefreshEnabled) {
			const refreshSuccess = await refreshAccessToken(originalFetcher, cookies);
			if (refreshSuccess) {
				response = await originalFetcher(input, init);
			} else if (typeof window !== 'undefined') {
				window.location.href = `/login?redirectTo=${encodeURIComponent(window.location.pathname)}`;
			}
		}

		// 2. Wrap JSON method to unwrap the backend envelope
		const originalJson = response.json.bind(response);
		response.json = async () => {
			const body = await originalJson();
			// Flatten: if backend returned { success: true, data: ... }, return just the data
			if (body && typeof body === 'object' && body.success === true && 'data' in body) {
				return body.data;
			}
			return body;
		};

		return response;
	};

	const activeFetcher = customFetcher;

	const client = treaty<App>(API_URL, {
		fetcher: activeFetcher as typeof fetch,
		fetch: {
			credentials: 'include'
		},
		headers: {
			...getDefaultHeaders(),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(cookies ? { Cookie: cookies } : {})
		}
	});

	// Cast to flattened type so IDE suggests payload properties directly
	return client as unknown as FlattenTreaty<typeof client>;
};

/**
 * Unified EdenTreaty API client for client-side usage
 */
export const api = createTreatyClient();
