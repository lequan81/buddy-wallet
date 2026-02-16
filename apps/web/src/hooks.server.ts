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

		// In hooks.server.ts, modify this logic:
		// Allow /me + refresh on landing page for session persistence
		// But skip on other public routes (login, signup, etc.) to keep them fast
		const shouldAttemptMe = Boolean(currentToken) && (!isPublic || pathname === '/');
		const shouldAttemptRefresh = Boolean(refreshToken) && (!isPublic || pathname === '/');

		// Only try /me if we have a session token (and this route benefits from it)
		if (shouldAttemptMe && currentToken) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

			const rawRes = await event.fetch(`${API_URL}/v1/auth/me`, {
				method: 'GET',
				signal: controller.signal,
				headers: {
					...getAuthHeaders(currentToken),
					'User-Agent': event.request.headers.get('user-agent') || ''
				}
			});

			clearTimeout(timeout);

			const rawData = await rawRes.json().catch(() => null);

			if (rawRes.ok && rawData?.data?.user) {
				user = rawData.data.user;
			}
		}

		// If user is not found and we have a refresh token, try to refresh
		if (!user && shouldAttemptRefresh && refreshToken) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

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

			if (refreshRes.ok) {
				const refreshData = await refreshRes.json().catch(() => null);
				if (refreshData.success && refreshData.data?.user) {
					user = refreshData.data.user;

					// Forward the new cookies to the browser and capture new token
					const setCookieHeaders = refreshRes.headers.getSetCookie?.() || [];
					if (setCookieHeaders.length === 0) {
						// Fallback for older environments
						const setCookie = refreshRes.headers.get('set-cookie');
						if (setCookie) setCookieHeaders.push(setCookie);
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

	// In production, send to error tracking service
	// await sendToErrorTracking({ error, status, url: event.url.pathname });

	// Return user-friendly error
	return {
		message: status === 404 ? 'Page not found' : 'An unexpected error occurred',
		code: status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR'
	};
};
