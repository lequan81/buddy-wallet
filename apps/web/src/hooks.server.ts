import { dev } from '$app/environment';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { createTreatyClient } from '$lib/eden';
import { API_URL, getDefaultHeaders, getAuthHeaders } from '$lib/api';

const AUTH_TIMEOUT_MS = 3500;

function isAbortError(err: unknown): boolean {
	return (
		typeof err === 'object' &&
		err !== null &&
		'name' in err &&
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		((err as any).name === 'AbortError' || (err as any).name === 'TimeoutError')
	);
}

const handleParaglide: Handle = async ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

export const handleTheme: Handle = async ({ event, resolve }) => {
	const theme = event.cookies.get('site-theme') ?? 'light';
	event.locals.theme = theme as 'light' | 'dark';

	return resolve(event, {
		transformPageChunk: ({ html }) => {
			// Inject dark class and lang attribute directly into <html>
			return html.replace('%theme%', theme === 'dark' ? 'dark' : '');
		}
	});
};

export const handleAuth: Handle = async ({ event, resolve }) => {
	let currentToken = event.cookies.get('session');
	const refreshToken = event.cookies.get('refresh_token');
	const pathname = event.url.pathname;

	// Public routes - no auth required
	// NOTE: we compute this BEFORE any API calls so public navigations stay fast.
	const isPublic =
		pathname === '/' ||
		/^\/[a-z]{2}\/?$/.test(pathname) ||
		pathname.includes('/login') ||
		pathname.includes('/signup') ||
		pathname.includes('/forgot-password') ||
		pathname.includes('/reset-password') ||
		pathname.includes('/check-debt') ||
		pathname.includes('/public') ||
		pathname.includes('/about') ||
		pathname.includes('/faq') ||
		pathname.includes('/privacy') ||
		pathname.includes('/terms');

	// Try to get user from API
	let user = null;
	let apiOffline = false;

	try {
		// IMPORTANT PERFORMANCE RULE:
		// - On PUBLIC routes, do not do refresh flows.
		// - Optionally do a very fast /me (timeout) if we already have a session token.
		// This prevents slow landing->login navigations when refresh_token is stale or API is slow.

		// Allow /me + refresh on: protected routes, landing page, AND login/signup
		// Login/signup: so users with valid refresh tokens get auto-logged in
		const isLoginOrSignup =
			pathname.includes('/login') ||
			pathname.includes('/signup') ||
			pathname.includes('/forgot-password') ||
			pathname.includes('/reset-password');
		const shouldAttemptMe =
			Boolean(currentToken) && (!isPublic || pathname === '/' || isLoginOrSignup);
		const shouldAttemptRefresh =
			Boolean(refreshToken) && (!isPublic || pathname === '/' || isLoginOrSignup);

		// Declare rawRes outside the if block for broader scope
		let rawRes: Response | undefined;

		// Only try /me if we have a session token (and this route benefits from it)
		if (shouldAttemptMe && currentToken) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

			rawRes = await event.fetch(`${API_URL}/v1/auth/me`, {
				method: 'GET',
				signal: controller.signal,
				headers: {
					...getAuthHeaders(currentToken),
					'User-Agent': event.request.headers.get('user-agent') || ''
				}
			});

			clearTimeout(timeout);

			const rawData = await rawRes.json().catch(() => null);

			// If user is found but account is locked, redirect to locked page
			if (rawRes.ok && rawData?.data?.user?.isLocked) {
				// Check if there's a lockoutUntil date (temporary lock)
				const lockoutUntil = rawData.data.user.lockoutUntil;
				const isTemporaryLock = lockoutUntil && new Date(lockoutUntil) > new Date();

				if (isTemporaryLock || !lockoutUntil) {
					// Clear auth cookies to force logout
					event.cookies.delete('session', { path: '/' });
					event.cookies.delete('refresh_token', { path: '/' });

					// Redirect to locked account page with details
					const params = new URLSearchParams();
					if (lockoutUntil) {
						params.set('until', lockoutUntil);
					}
					params.set('email', rawData.data.user.email || '');
					throw redirect(303, `/account-locked?${params.toString()}`);
				}
			}

			if (rawRes.ok && rawData?.data?.user) {
				user = rawData.data.user;
			} else if (rawRes.status === 401) {
				// Token expired - will trigger refresh below
				console.log('[HOOKS] /me returned 401, token expired, will attempt refresh');
			}
		}

		// If user is not found OR token expired (401) and we have a refresh token, try to refresh
		if ((!user || rawRes?.status === 401) && shouldAttemptRefresh && refreshToken) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

			// DEBUG: Log the API URL being used
			console.log('[HOOKS] Attempting refresh with API_URL:', API_URL);
			console.log('[HOOKS] Refresh token exists:', !!refreshToken);

			const refreshRes = await event.fetch(`${API_URL}/v1/auth/refresh`, {
				method: 'POST',
				signal: controller.signal,
				headers: {
					...getDefaultHeaders(),
					Cookie: `refresh_token=${refreshToken}`,
					'User-Agent': event.request.headers.get('user-agent') || ''
				}
			});

			clearTimeout(timeout);

			// DEBUG: Log response status
			console.log('[HOOKS] Refresh response status:', refreshRes.status);
			console.log('[HOOKS] Refresh response ok:', refreshRes.ok);

			if (refreshRes.ok) {
				const refreshData = await refreshRes.json().catch(() => null);
				console.log('[HOOKS] Refresh data:', refreshData);
				if (refreshData.success && refreshData.data?.user) {
					user = refreshData.data.user;
					console.log('[HOOKS] User refreshed successfully:', user.id);

					// Forward the new cookies to the browser and capture new token
					let setCookieHeaders: string[] = [];
					try {
						setCookieHeaders = refreshRes.headers.getSetCookie?.() ?? [];
					} catch {
						// Fallback: split combined set-cookie header for runtimes that don't support getSetCookie
						const raw = refreshRes.headers.get('set-cookie');
						if (raw) {
							setCookieHeaders = raw.split(/,(?=\s*\w+=)/).map((s) => s.trim());
						}
					}
					for (const cookieHeader of setCookieHeaders) {
						const sessionMatch = cookieHeader.match(/session=([^;]+)/);
						if (sessionMatch) {
							currentToken = sessionMatch[1]; // Update current token!
							event.cookies.set('session', currentToken, {
								path: '/',
								httpOnly: true,
								secure: !dev,
								sameSite: 'lax',
								maxAge: 15 * 60 // 15 minutes
							});
						}

						// Also update refresh token if rotated
						const refreshMatch = cookieHeader.match(/refresh_token=([^;]+)/);
						if (refreshMatch) {
							event.cookies.set('refresh_token', refreshMatch[1], {
								path: '/',
								httpOnly: true,
								secure: !dev,
								sameSite: 'lax',
								maxAge: 90 * 24 * 60 * 60 // 90 days
							});
						}
					}
				} else {
					console.log('[HOOKS] Refresh data invalid:', refreshData);
				}
			} else {
				console.log('[HOOKS] Refresh failed with status:', refreshRes.status);
				// Try to get error response
				try {
					const errorText = await refreshRes.text();
					console.log('[HOOKS] Refresh error response:', errorText);
				} catch (e) {
					console.log('[HOOKS] Could not read error response:', e);
				}
			}
		}
	} catch (_err: unknown) {
		// Backend unavailable or auth endpoints slow/unreachable
		// - For timeouts, do not mark API offline (keeps public nav snappy).
		// - For real network failures, mark offline for protected routes.
		if (!isAbortError(_err)) {
			console.warn('[WARN] Backend API unavailable');
			// only surface offline banner when it actually matters (non-public routes)
			apiOffline = !isPublic;
		}
	}

	// Store user, token, and pre-configured API in locals
	event.locals.user = user;
	event.locals.apiOffline = apiOffline;
	event.locals.accessToken = currentToken;
	event.locals.api = createTreatyClient(event.fetch, currentToken);

	// DEBUG: Log final auth state
	// Only log auth state for protected route document navigations (not assets)
	if (dev && !isPublic && event.request.headers.get('sec-fetch-dest') === 'document') {
		console.log('[HOOKS] Final state:', user ? `user=${user.id}` : 'no user');
	}

	// Redirect to login if accessing protected route without auth
	if (!isPublic && !event.locals.user) {
		const redirectTo = encodeURIComponent(pathname);
		throw redirect(303, `/login?redirectTo=${redirectTo}`);
	}

	// Auto-redirect authenticated users away from login/signup
	if (user && (pathname.includes('/login') || pathname.includes('/signup'))) {
		// Respect any redirectTo param if present
		const redirectTo = event.url.searchParams.get('redirectTo');
		throw redirect(303, redirectTo ? decodeURIComponent(redirectTo) : '/dashboard');
	}

	// Check permission for admin routes
	if (pathname.startsWith('/admin/')) {
		const hasAdminPermission = event.locals.user?.permissions?.includes('admin:view');
		if (!hasAdminPermission) {
			throw redirect(303, '/');
		}
	}

	return resolve(event);
};

export const handleDevtoolsJson: Handle = ({ event, resolve }) => {
	if (dev && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
		return new Response(undefined, { status: 204 }); // 204: No Content
	}

	return resolve(event);
};

export const handle: Handle = sequence(
	handleParaglide,
	handleTheme,
	handleAuth,
	handleDevtoolsJson
);

/**
 * Server-side error handler
 * Logs errors and returns user-friendly messages
 */
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	// Log error details
	console.error('[Server Error]', {
		error,
		status,
		message,
		url: event.url.pathname,
		timestamp: new Date().toISOString()
	});

	// In production, send to error tracking service (e.g., Sentry, BetterStack)
	// For server-side, prefer a logging/APM service over HTTP calls.
	// Example with Sentry:
	// import * as Sentry from '@sentry/node';
	// Sentry.captureException(error, { extra: { status, url: event.url.pathname } });

	// Return user-friendly error
	return {
		message: status === 404 ? 'Page not found' : 'An unexpected error occurred',
		code: status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR'
	};
};
