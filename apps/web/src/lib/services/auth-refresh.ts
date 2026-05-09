/**
 * Shared Token Refresh Logic
 *
 * Single source of truth for access token refresh.
 * Used by both apiFetch() and Eden treaty client.
 * Prevents duplicate simultaneous refresh requests.
 */
import { API_URL, getDefaultHeaders } from './api-config';
import { treaty } from '@elysiajs/eden';

import type { App } from '@repo/api/types';

// Singleton promise prevents multiple concurrent refresh attempts
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh the access token using the refresh token cookie.
 * Returns true if refresh succeeded, false otherwise.
 *
 * If a refresh is already in progress, all callers share the same promise
 * to avoid multiple /refresh calls racing each other.
 */
export async function refreshAccessToken(
	customFetch?: typeof fetch,
	cookies?: string
): Promise<boolean> {
	if (refreshPromise) return refreshPromise;

	refreshPromise = (async () => {
		try {
			const fetchClient = customFetch || fetch;
			const api = treaty<App>(API_URL, {
				fetcher: fetchClient as typeof fetch,
				fetch: { credentials: 'include' },
				headers: {
					...getDefaultHeaders(),
					...(cookies ? { Cookie: cookies } : {})
				}
			});
			// Extract refresh token from cookies string — bail if absent
			const refreshToken = cookies?.match(/refresh_token=([^;]+)/)?.[1];
			if (!refreshToken) return false;
			const { data, error } = await api.v1.auth.refresh.post({ refreshToken });
			if (error) return false;
			// Backend returns success response directly (no envelope), just check if we got data
			return data != null;
		} catch {
			return false;
		} finally {
			refreshPromise = null;
		}
	})();

	return refreshPromise;
}
