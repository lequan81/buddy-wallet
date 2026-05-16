/**
 * API Response Helpers
 *
 * Minimal utilities for safely extracting data from Treaty API responses.
 * The backend wraps success payloads in { data, message?, meta? }.
 * These helpers handle type narrowing after Treaty's discriminated union check.
 */

/** Safely extract the nested `data` field from a Treaty success response. */

import type { Cookies } from '@sveltejs/kit';

/**
 * Extract session and refresh tokens from response Set-Cookie headers
 * and sync them to SvelteKit's cookies object.
 */
export function syncCookiesFromResponse(response: Response, cookies: Cookies) {
	const setCookieHeaders = response.headers.getSetCookie?.() || [];

	for (const cookieHeader of setCookieHeaders) {
		const sessionMatch = cookieHeader.match(/session=([^;]+)/);
		const sessionToken = sessionMatch?.[1];
		if (sessionToken) {
			cookies.set('session', sessionToken as string, {
				path: '/',
				httpOnly: true,
				secure: import.meta.env.PROD,
				sameSite: 'lax',
				maxAge: 15 * 60
			});
		}

		const refreshMatch = cookieHeader.match(/refresh_token=([^;]+)/);
		const refreshToken = refreshMatch?.[1];
		if (refreshToken) {
			cookies.set('refresh_token', refreshToken as string, {
				path: '/',
				httpOnly: true,
				secure: import.meta.env.PROD,
				sameSite: 'lax',
				maxAge: 90 * 24 * 60 * 60
			});
		}
	}
}

export function unwrapData<T = unknown>(response: unknown): T | null {
	if (!response || typeof response !== 'object') return null;
	const r = response as Record<string, unknown>;
	return (r.data as T) ?? null;
}

/** Safely extract the nested `meta` field from a Treaty success response. */
export function unwrapMeta(response: unknown): Record<string, unknown> | null {
	if (!response || typeof response !== 'object') return null;
	const r = response as Record<string, unknown>;
	return (r.meta as Record<string, unknown>) ?? null;
}

/** Safely extract pagination from the meta field. */
export function unwrapPagination(response: unknown, defaults?: { page?: number; limit?: number }) {
	const meta = unwrapMeta(response);
	const pagination = meta?.pagination as Record<string, number> | undefined;
	return {
		page: pagination?.page ?? defaults?.page ?? 1,
		limit: pagination?.limit ?? defaults?.limit ?? 10,
		total: pagination?.total ?? 0,
		totalPages: pagination?.totalPages ?? 1
	};
}

/** Safely extract error message from a Treaty error value. */
export function getErrorMessage(errorValue: unknown, fallback = 'An error occurred'): string {
	if (!errorValue || typeof errorValue !== 'object') return fallback;
	const e = errorValue as Record<string, unknown>;
	return (e.message as string) ?? fallback;
}
