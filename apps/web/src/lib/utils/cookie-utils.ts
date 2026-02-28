/**
 * Cookie utility functions for client-side storage
 * Replaces localStorage for banner dismissals and preferences
 */

/**
 * Set a cookie with the given name, value, and max age in days
 */
export function setCookie(name: string, value: string, maxAgeDays: number): void {
	document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAgeDays * 86400};SameSite=Lax`;
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(name: string): void {
	document.cookie = `${name}=;path=/;max-age=0`;
}
