/**
 * Shared Token Refresh Logic
 *
 * Single source of truth for access token refresh.
 * Used by both apiFetch() and Eden treaty client.
 * Prevents duplicate simultaneous refresh requests.
 */
import { API_URL, getDefaultHeaders } from './api';

// Singleton promise prevents multiple concurrent refresh attempts
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh the access token using the refresh token cookie.
 * Returns true if refresh succeeded, false otherwise.
 *
 * If a refresh is already in progress, all callers share the same promise
 * to avoid multiple /refresh calls racing each other.
 */
export async function refreshAccessToken(customFetch?: typeof fetch): Promise<boolean> {
	if (refreshPromise) return refreshPromise;

	refreshPromise = (async () => {
		try {
			const fetchClient = customFetch || fetch;
			const response = await fetchClient(`${API_URL}/v1/auth/refresh`, {
				method: 'POST',
				credentials: 'include', // Send refresh_token cookie
				headers: getDefaultHeaders()
			});

			return response.ok;
		} catch {
			return false;
		} finally {
			refreshPromise = null;
		}
	})();

	return refreshPromise;
}
