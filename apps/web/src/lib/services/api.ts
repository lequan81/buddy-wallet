/**
 * Global API Configuration & Helpers
 * Centralizes all API-related settings and utilities
 */

import { treaty } from '@elysiajs/eden';
import type { App } from '@repo/api/types';
import {
	API_URL,
	getDefaultHeaders
} from './api-config';

export { API_URL, WEB_URL, getDefaultHeaders, getAuthHeaders, getServerHeaders } from './api-config';

// --- Type Utilities ---

/**
 * Recursive type that unwraps ApiResponse envelopes from Eden Treaty results.
 * This ensures the frontend works with normalized payloads directly.
 *
 * Key fix: preserves intersection types where an endpoint is BOTH callable
 * (for parametrized routes like `debts({ id })`) AND has object properties
 * (for direct routes like `debts.get()`).
 */
type FlattenTreaty<T> = T extends (...args: infer Args) => infer R
	? ((...args: Args) => FlattenTreaty<R>) & {
		[K in keyof T as K extends keyof ((...args: unknown[]) => unknown) ? never : K]: FlattenTreaty<T[K]>
	  }
	: T extends Promise<infer R>
	? Promise<FlattenTreaty<R>>
	: T extends { data: infer D; error: infer E; status: infer S; response: infer Res }
	? { data: D; error: E; status: S; response: Res }
	: T extends object
	? { [K in keyof T]: FlattenTreaty<T[K]> }
	: T;

// Shared refresh logic — single source of truth (prevents dual refresh races)
import { refreshAccessToken } from './auth-refresh';

/**
 * Create a Treaty client with auto-refresh support and stable typing.
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
	 * 2. Preserves backend JSON body shape (no runtime unwrapping)
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
				window.location.href = '/login';
			}
		}

		// 2. Keep the backend JSON body shape unchanged
		const originalJson = response.json.bind(response);
		response.json = async () => {
			const body = await originalJson();
			// Return response body as-is.
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

	// Cast to a function/object-preserving type without modifying runtime payload shape
	return client as unknown as FlattenTreaty<typeof client>;
};

let _api: ReturnType<typeof createTreatyClient> | undefined;
export function getApi() {
	if (!_api) _api = createTreatyClient();
	return _api;
}

/**
 * Unified EdenTreaty API client for client-side usage.
 * Uses a Proxy to avoid eager initialization during SSR.
 */
export const api = new Proxy({} as ReturnType<typeof createTreatyClient>, {
	get(_, prop) {
		return getApi()[prop as keyof ReturnType<typeof createTreatyClient>];
	}
});
