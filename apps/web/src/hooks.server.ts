import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { createApi } from '$lib/eden';

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
	const token = event.cookies.get('session');
	const refreshToken = event.cookies.get('refresh_token');
	const api = createApi(event.fetch, token);
	const pathname = event.url.pathname;

	// Try to get user from API
	let user = null;
	let apiOffline = false;

	try {
		const { data, error } = await api.v1.auth.me.get();

		if (!error && data?.user) {
			user = data.user;
		}

		// If user is not found (either error or null data) and we have a refresh token, try to refresh
		if (!user && refreshToken) {
			console.log('[AUTH] User not found or token expired, attempting refresh...');

			const refreshRes = await event.fetch('http://localhost:3000/v1/auth/refresh', {
				method: 'POST',
				headers: {
					Cookie: `refresh_token=${refreshToken}`,
					'Content-Type': 'application/json'
				}
			});

			if (refreshRes.ok) {
				const refreshData = await refreshRes.json();
				if (refreshData.success && refreshData.user) {
					user = refreshData.user;

					// Forward the new cookies to the browser
					const setCookieHeaders = refreshRes.headers.getSetCookie?.() || [];
					if (setCookieHeaders.length === 0) {
						// Fallback for older environments
						const setCookie = refreshRes.headers.get('set-cookie');
						if (setCookie) setCookieHeaders.push(setCookie);
					}

					for (const cookieHeader of setCookieHeaders) {
						const sessionMatch = cookieHeader.match(/session=([^;]+)/);
						if (sessionMatch) {
							event.cookies.set('session', sessionMatch[1], {
								path: '/',
								httpOnly: true,
								secure: process.env.NODE_ENV === 'production',
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
								secure: process.env.NODE_ENV === 'production',
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

	event.locals.user = user;
	event.locals.apiOffline = apiOffline;

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
	if (process.env.NODE_ENV !== 'production') {
		console.log(
			`[AUTH] ${pathname} → ${isPublic ? 'public' : 'protected'} | user: ${event.locals.user?.email || 'guest'}`
		);
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

export const handle: Handle = sequence(handleParaglide, handleTheme, handleAuth);
