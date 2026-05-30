import type { Cookies } from '@sveltejs/kit';
import type { VietQRBank } from '@repo/types/shared/bank';
import { FRONTEND_CONSTANTS } from '@repo/config/frontend';

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

/** Safely extract the nested `data` field from a Treaty success response. */
export function unwrapData<T>(response: { data?: T } | null | undefined): T | null {
	return response?.data ?? null;
}

/** Safely extract the nested `meta` field from a Treaty success response. */
export function unwrapMeta(response: { meta?: Record<string, unknown> } | null | undefined): Record<string, unknown> | null {
	return response?.meta ?? null;
}

/** Safely extract pagination from the meta field. */
export function unwrapPagination(response: { meta?: { pagination?: Record<string, number> } } | null | undefined, defaults?: { page?: number; limit?: number }) {
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

/**
 * Normalize and filter a list of debt IDs from string input or array
 */
export const normalizeDebtIdList = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
	}

	if (typeof value === 'string') {
		return value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	return [];
};

/**
 * Fetch supported banks with frontend-first strategy
 * 1. Tries VietQR API directly (fast, reduces backend load)
 * 2. On timeout/error, falls back to provided backend function
 */
export async function fetchBanks(
	backendFallbackFn?: () => Promise<VietQRBank[]>
): Promise<VietQRBank[]> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), FRONTEND_CONSTANTS.VIETQR_TIMEOUT);

		const response = await fetch(FRONTEND_CONSTANTS.VIETQR_API_URL, { signal: controller.signal });
		clearTimeout(timeoutId);

		if (response.ok) {
			const result = await response.json();
			if (result.code === '00' && Array.isArray(result.data)) {
				return result.data;
			}
		}
	} catch (err) {
		console.warn('[VietQR] API timeout or error, using backend fallback:', err);
	}

	if (backendFallbackFn) {
		return backendFallbackFn();
	}

	return [];
}
