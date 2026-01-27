import { dev } from "$app/environment"
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { createTreatyClient } from '$lib/eden';
import { API_URL, getDefaultHeaders } from '$lib/api';

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

	// Debug: Log what cookies we have at the start
	console.log(`[DEBUG] Cookies present - Session: ${!!currentToken}, Refresh: ${!!refreshToken}`);

	// Try to get user from API
	let user = null;
	let apiOffline = false;

	try {
		// Only try /me if we have a session token
		if (currentToken) {
			console.log(`[DEBUG] Calling /me with token: ${currentToken.substring(0, 20)}...`);

			// BYPASS EDEN - Use raw fetch to debug
			const rawRes = await fetch(`${API_URL}/v1/auth/me`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${currentToken}`,
					'Content-Type': 'application/json',
					'Origin': 'http://localhost:5173',
					'Referer': 'http://localhost:5173/'
				}
			});
			console.log(`[DEBUG] Raw fetch status: ${rawRes.status}`);
			const rawData = await rawRes.json();
			console.log(`[DEBUG] Raw fetch response:`, JSON.stringify(rawData));

			if (rawRes.ok && rawData?.user) {
				user = rawData.user;
				console.log(`[DEBUG] /me succeeded: ${user.email}`);
			} else {
				console.log(`[DEBUG] /me failed:`, rawData);
			}
		}

		// If user is not found and we have a refresh token, try to refresh
		if (!user && refreshToken) {
			const refreshRes = await event.fetch(`${API_URL}/v1/auth/refresh`, {
				method: 'POST',
				headers: {
					...getDefaultHeaders(),
					Cookie: `refresh_token=${refreshToken}`
				}
			});

			if (refreshRes.ok) {
				const refreshData = await refreshRes.json();
				if (refreshData.success && refreshData.user) {
					user = refreshData.user;

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
								sameSite: 'strict',
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
								sameSite: 'strict',
								maxAge: 90 * 24 * 60 * 60 // 90 days
							});
						}
					}
					console.log('[AUTH] Token refreshed successfully');
				}
			} else {
				console.log('[AUTH] Refresh failed, user needs to login again');
			}
		}
	} catch (err: unknown) {
		const errCode = (err as { cause?: { code?: string } })?.cause?.code;
		if (errCode === 'ECONNREFUSED') {
			console.warn('[API] Backend unavailable - running in offline mode');
		} else {
			console.warn('[API] Connection failed:', errCode || 'Unknown error');
		}
		apiOffline = true;
	}

	// Store user, token, and pre-configured API in locals
	event.locals.user = user;
	event.locals.apiOffline = apiOffline;
	event.locals.accessToken = currentToken;
	event.locals.api = createTreatyClient(event.fetch, currentToken);

	// Public routes - no auth required
	const isPublic =
		pathname === '/' ||
		/^\/[a-z]{2}\/?$/.test(pathname) ||
		pathname.includes('/login') ||
		pathname.includes('/signup') ||
		pathname.includes('/check-debt') ||
		pathname.includes('/public') ||
		pathname.includes('/about');

	// Debug log (only in dev)
	if (dev) {
		console.log(
			`[AUTH] ${pathname} → ${isPublic ? 'public' : 'protected'} | user: ${event.locals.user?.email || 'guest'}`
		);
		// Log why user is guest if they are on a protected route or just logged in
		if (!event.locals.user) {
			console.log(`[DEBUG] Cookies present - Session: ${!!currentToken}, Refresh: ${!!refreshToken}`);
		}
	}

	// Redirect to login if accessing protected route without auth
	if (!isPublic && !event.locals.user) {
		const redirectTo = encodeURIComponent(pathname);
		throw redirect(303, `/login?redirectTo=${redirectTo}`);
	}

	// Check permission for admin routes
	if (pathname.startsWith('/admin')) {
		const hasAdminPermission = event.locals.user?.permissions?.includes('admin:view');
		if (!hasAdminPermission) {
			throw redirect(303, '/');
		}
	}

	return resolve(event);
};

export const handleDevtoolsJson: Handle = ({ event, resolve }) => {
	if (dev && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
		return new Response(undefined, { status: 204 });  // 204: No Content
	}

	return resolve(event);
};

export const handle: Handle = sequence(handleParaglide, handleTheme, handleAuth, handleDevtoolsJson);
