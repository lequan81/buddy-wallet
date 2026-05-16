/**
 * Navigation Service
 * Typed route helpers to avoid raw string redirects and manual param parsing.
 */
import { redirect as svelteRedirect } from '@sveltejs/kit';

export const ROUTES = {
	HOME: '/',
	DASHBOARD: '/dashboard',
	LOGIN: '/login',
	SIGNUP: '/signup',
	FORGOT_PASSWORD: '/forgot-password',
	RESET_PASSWORD: '/reset-password',
	VERIFY_EMAIL: '/verify-email',
	CHANGE_PASSWORD: '/change-password',
	ACCOUNT_LOCKED: '/account-locked',
	SETTINGS_PROFILE: '/settings/profile',
	SETTINGS_BANKS: '/settings/banks',
	DEBTS_CREATE: '/debts/create'
} as const;

export type RouteKey = keyof typeof ROUTES;

/**
 * Build a URL with query parameters.
 */
export function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
	if (!params) return path;

	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined) {
			searchParams.set(key, String(value));
		}
	}

	const queryString = searchParams.toString();
	return queryString ? `${path}?${queryString}` : path;
}

/**
 * Type-safe redirect helper.
 */
export function redirect(
	status: 300 | 301 | 302 | 303 | 307 | 308,
	path: string,
	params?: Record<string, string | number | boolean | undefined>
): never {
	throw svelteRedirect(status, buildUrl(path, params));
}

/**
 * Typed search param extractor.
 */
export function getParam<T extends string = string>(
	url: URL,
	name: string,
	fallback?: T
): T | undefined {
	return (url.searchParams.get(name) as T) || fallback;
}

export function getIntParam(url: URL, name: string, fallback: number): number {
	const val = url.searchParams.get(name);
	if (!val) return fallback;
	const parsed = parseInt(val, 10);
	return isNaN(parsed) ? fallback : parsed;
}

export function getBoolParam(url: URL, name: string): boolean {
	return url.searchParams.get(name) === 'true';
}
