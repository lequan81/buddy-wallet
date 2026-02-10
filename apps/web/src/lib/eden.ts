import { treaty } from '@elysiajs/eden';
import type { App } from '@repo/api';
import { API_URL, getDefaultHeaders } from './api';

// Track ongoing refresh to prevent multiple simultaneous refreshes
let edenRefreshPromise: Promise<boolean> | null = null;

/**
 * Refresh access token for Eden client
 */
async function refreshForEden(): Promise<boolean> {
	if (edenRefreshPromise) {
		return edenRefreshPromise;
	}

	edenRefreshPromise = (async () => {
		try {
			const response = await fetch(`${API_URL}/v1/auth/refresh`, {
				method: 'POST',
				credentials: 'include',
				headers: getDefaultHeaders()
			});

			if (response.ok) {
				console.log('[Eden] Token refreshed successfully');
				return true;
			}

			console.warn('[Eden] Token refresh failed:', response.status);
			return false;
		} catch (error) {
			console.error('[Eden] Refresh error:', error);
			return false;
		} finally {
			edenRefreshPromise = null;
		}
	})();

	return edenRefreshPromise;
}

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

			const refreshSuccess = await refreshForEden();

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
