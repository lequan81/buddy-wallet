import { treaty } from '@elysiajs/eden';
import type { App } from '@repo/api';
import { API_URL, getDefaultHeaders } from './api';

// Shared refresh logic — same singleton as apiFetch (prevents dual refresh races)
import { refreshAccessToken } from './auth-refresh';

/**
 * Create a Treaty client with auto-refresh support
 *
 * SECURITY: Automatically refreshes token on 401 errors
 */
export const createTreatyClient = (fetcher?: typeof fetch, token?: string) => {
	// Custom fetcher with auto-refresh
	const autoRefreshFetcher = async (
		input: RequestInfo | URL,
		init?: RequestInit
	): Promise<Response> => {
		const originalFetcher = fetcher || fetch;
		const response = await originalFetcher(input, init);

		// Auto-refresh on 401 (except for refresh endpoint itself)
		const urlString =
			typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		const isRefreshEndpoint = urlString.includes('/auth/refresh');

		if (response.status === 401 && !isRefreshEndpoint) {
			console.log('[Eden] 401 detected, attempting token refresh...');

			const refreshSuccess = await refreshAccessToken(originalFetcher);

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

	return treaty<App>(API_URL, {
		fetcher: autoRefreshFetcher as typeof fetch,
		fetch: {
			credentials: 'include' // Send cookies with cross-origin requests
		},
		headers: {
			...getDefaultHeaders(), // Always include Origin/Referer for CSRF
			...(token ? { Authorization: `Bearer ${token}` } : {})
		}
	});
};
