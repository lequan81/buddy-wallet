import { dev } from '$app/environment';
import type { Handle, HandleServerError, RequestEvent } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '$lib/services/navigation';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { createTreatyClient } from '$lib/services/api';
import { unwrapData } from '$lib/services/api-helpers';
import { FRONTEND_CONSTANTS } from '@repo/config/frontend';
type AuthStatus = 'idle' | 'resolving' | 'authenticated' | 'unauthenticated' | 'offline';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAbortError(err: unknown): boolean {
	return (
		err instanceof Error &&
		(err.name === 'AbortError' || err.name === 'TimeoutError')
	);
}

function normalizePathname(pathname: string): string {
	if (!pathname) return '/';
	if (pathname === '/') return '/';
	return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function stripLocalePrefix(pathname: string): string {
	const normalized = normalizePathname(pathname);
	const segments = normalized.split('/').filter(Boolean);
	if (segments.length === 0) return '/';

	if (/^[a-z]{2}$/i.test(segments[0])) {
		const remaining = segments.slice(1);
		return remaining.length ? `/${remaining.join('/')}` : '/';
	}

	return normalized;
}

function matchesExactOrPrefix(pathname: string, base: string): boolean {
	return pathname === base || pathname.startsWith(`${base}/`);
}

/** Classify a pathname as public (no auth required) or protected. */
function isPublicRoute(pathname: string): boolean {
	const routePath = stripLocalePrefix(pathname);
	return (
		routePath === '/' ||
		matchesExactOrPrefix(routePath, '/login') ||
		matchesExactOrPrefix(routePath, '/signup') ||
		matchesExactOrPrefix(routePath, '/verify-email') ||
		matchesExactOrPrefix(routePath, '/forgot-password') ||
		matchesExactOrPrefix(routePath, '/reset-password') ||
		matchesExactOrPrefix(routePath, '/check-debt') ||
		matchesExactOrPrefix(routePath, '/public') ||
		routePath === '/about' ||
		routePath === '/faq' ||
		routePath === '/privacy' ||
		routePath === '/terms'
	);
}

function isAdminRoute(pathname: string): boolean {
	const routePath = stripLocalePrefix(pathname);
	return routePath === '/admin' || routePath.startsWith('/admin/');
}

/** Routes where we should attempt /me + refresh even though they're "public". */
function isAuthAwarePublicRoute(pathname: string): boolean {
	const routePath = stripLocalePrefix(pathname);
	return (
		routePath === '/' ||
		matchesExactOrPrefix(routePath, '/login') ||
		matchesExactOrPrefix(routePath, '/signup') ||
		matchesExactOrPrefix(routePath, '/forgot-password') ||
		matchesExactOrPrefix(routePath, '/reset-password')
	);
}

// ─── Auth sub-routines ───────────────────────────────────────────────────────

/**
 * Try to fetch the current user via /auth/me using the session token.
 * Returns `{ user, status }` — user is null if the call fails or times out.
 */
async function tryGetUser(
	event: RequestEvent,
	token: string,
	timeoutMs: number
): Promise<{ user: App.Locals['user']; status: number | undefined; timedOut: boolean }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const api = createTreatyClient(
			event.fetch,
			token,
			event.request.headers.get('cookie') || '',
			{ autoRefresh: false }
		);

		const { data, error, status } = await api.v1.user.profile.get({
			fetch: { signal: controller.signal },
			headers: { 'User-Agent': event.request.headers.get('user-agent') || '' }
		});

		clearTimeout(timeout);

		// API returns { data: { ...user } } on success
		const user = unwrapData<App.Locals['user']>(data);

		if (!user && dev) {
			console.log(`[HOOKS:tryGetUser] Failed to get profile. Status: ${status}, Error:`, error?.value || 'Unknown');
		}

		// Handle locked account — redirect immediately
		if (user && (user as unknown as { isLocked?: boolean }).isLocked) {
			handleLockedAccount(event, user);
		}

		if (user) {
			return { user, status, timedOut: false };
		}

		return { user: null, status: status ?? (error ? 500 : 200), timedOut: false };
	} catch (err) {
		clearTimeout(timeout);
		if (isAbortError(err)) return { user: null, status: undefined, timedOut: true };
		throw err; // Re-throw network errors for the outer catch
	}
}

/**
 * Redirect to account-locked page if the user's account is locked.
 * Throws a SvelteKit redirect (never returns).
 */
function handleLockedAccount(
	event: RequestEvent,
	userData: App.Locals['user']
): never {
	if (!userData) redirect(303, `/account-locked`);

	const lockoutUntil = (userData as unknown as { lockoutUntil?: string }).lockoutUntil;
	const email = userData.email || '';

	redirect(303, `/account-locked`, { until: lockoutUntil, email });
}

/**
 * Try to refresh the session using the refresh token.
 * On success, updates cookies and returns the user + new session token.
 */
async function tryRefreshToken(
	event: RequestEvent,
	refreshToken: string,
	timeoutMs: number
): Promise<{ user: App.Locals['user']; newSessionToken: string | undefined; timedOut: boolean }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const api = createTreatyClient(
			event.fetch,
			undefined,
			`refresh_token=${refreshToken}`,
			{ autoRefresh: false }
		);

		const { data, error, response } = await api.v1.auth.refresh.post(
			{ refreshToken },
			{
				fetch: { signal: controller.signal },
				headers: { 'User-Agent': event.request.headers.get('user-agent') || '' }
			}
		);

		clearTimeout(timeout);

		// Refresh endpoint returns { data: { accessToken, refreshToken, ... } }
		// It does NOT return user data. Check for data presence.
		const refreshData = unwrapData<{ accessToken?: string }>(data);
		if (error || !refreshData?.accessToken) {
			return { user: null, newSessionToken: undefined, timedOut: false };
		}

		// Forward new cookies to the browser and get the new session token
		const newToken = forwardRefreshCookies(event, response);

		// Re-call /me with the new token to get the user
		if (newToken) {
			const meResult = await tryGetUser(event, newToken, timeoutMs);
			return { user: meResult.user, newSessionToken: newToken, timedOut: meResult.timedOut };
		}

		return { user: null, newSessionToken: newToken, timedOut: false };
	} catch (err) {
		clearTimeout(timeout);
		if (isAbortError(err)) return { user: null, newSessionToken: undefined, timedOut: true };
		throw err;
	}
}

/**
 * Extract and forward Set-Cookie headers from the refresh response.
 * Returns the new session token if found.
 */
function forwardRefreshCookies(event: RequestEvent, refreshRes: Response): string | undefined {
	let setCookieHeaders: string[] = [];
	try {
		setCookieHeaders = refreshRes.headers.getSetCookie?.() ?? [];
	} catch {
		const raw = refreshRes.headers.get('set-cookie');
		if (raw) {
			setCookieHeaders = raw.split(/,(?=\s*\w+=)/).map((s) => s.trim());
		}
	}

	let newToken: string | undefined;

	for (const cookieHeader of setCookieHeaders) {
		const sessionMatch = cookieHeader.match(/session=([^;]+)/);
		if (sessionMatch) {
			newToken = sessionMatch[1];
			event.cookies.set('session', newToken, {
				path: '/',
				httpOnly: true,
				secure: !dev,
				sameSite: 'lax',
				maxAge: 15 * 60 // 15 minutes
			});
		}

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

	return newToken;
}

// ─── Handles ─────────────────────────────────────────────────────────────────

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
			return html.replace('%theme%', theme === 'dark' ? 'dark' : '');
		}
	});
};

export const handleAuth: Handle = async ({ event, resolve }) => {
	let currentToken = event.cookies.get('session');
	const refreshToken = event.cookies.get('refresh_token');
	const pathname = event.url.pathname;
	const routePath = stripLocalePrefix(pathname);
	const isPublic = isPublicRoute(pathname);
	const isAdmin = isAdminRoute(pathname);
	const hasSession = Boolean(currentToken || refreshToken);
	event.locals.hasSession = hasSession;
	if (dev && (pathname.includes('verify-email') || pathname.startsWith('/dashboard') || pathname === '/')) {
		console.log(`[DEBUG:AUTH] Path: ${pathname}, hasSession: ${Boolean(currentToken)}, hasRefresh: ${Boolean(refreshToken)}`);
	}
	let authStatus: AuthStatus = 'idle';

	// ── Determine whether to attempt auth ────────────────────────────────
	const isAuthAware = !isPublic || isAuthAwarePublicRoute(pathname);
	const shouldAttemptMe = Boolean(currentToken) && isAuthAware;
	const shouldAttemptRefresh = Boolean(refreshToken) && isAuthAware;
	const authTimeoutMs = isPublic
		? Math.min(FRONTEND_CONSTANTS.AUTH_TIMEOUT_MS, 1000)
		: FRONTEND_CONSTANTS.AUTH_TIMEOUT_MS;

	if (isAuthAware) {
		authStatus = 'resolving';
	}

	// ── Try to resolve user ──────────────────────────────────────────────
	let user: App.Locals['user'] = null;

	try {
		// Step 1: Try /me with current session token
		if (shouldAttemptMe && currentToken) {
			const result = await tryGetUser(event, currentToken, authTimeoutMs);
			user = result.user;

			if (result.timedOut && !result.user) {
				authStatus = 'offline';
			}

			if (user) {
				authStatus = 'authenticated';
			}

			// Step 2: If /me failed (401), try refresh
			if (!user && result.status === 401 && shouldAttemptRefresh && refreshToken) {
				const refreshResult = await tryRefreshToken(event, refreshToken, authTimeoutMs);
				user = refreshResult.user;

				if (refreshResult.timedOut && !refreshResult.user) {
					authStatus = 'offline';
				}

				if (user) {
					authStatus = 'authenticated';
				}

				if (refreshResult.newSessionToken) {
					currentToken = refreshResult.newSessionToken;
				}
			}
		}
		// Step 2b: No session token but have refresh token
		else if (shouldAttemptRefresh && refreshToken) {
			const refreshResult = await tryRefreshToken(event, refreshToken, authTimeoutMs);
			user = refreshResult.user;

			if (refreshResult.timedOut && !refreshResult.user) {
				authStatus = 'offline';
			}

			if (user) {
				authStatus = 'authenticated';
			}

			if (refreshResult.newSessionToken) {
				currentToken = refreshResult.newSessionToken;
			}
		}
	} catch (err: unknown) {
		if (!isAbortError(err)) {
			console.warn('[WARN] Backend API unavailable');
			authStatus = 'offline';
		}
	}

	if (!user && authStatus === 'resolving') {
		authStatus = 'unauthenticated';
	}

	const apiOffline = !isPublic && authStatus === 'offline';

	// ── Populate locals ──────────────────────────────────────────────────
	event.locals.user = user;
	event.locals.apiOffline = apiOffline;
	event.locals.hasSession = Boolean(currentToken || refreshToken);
	event.locals.accessToken = currentToken;
	event.locals.api = createTreatyClient(
		event.fetch,
		currentToken,
		event.request.headers.get('cookie') || ''
	);

	// ── Debug logging (dev only, protected document navigations) ─────────
	if (dev && !isPublic && event.request.headers.get('sec-fetch-dest') === 'document') {
		console.log('[HOOKS] Final state:', user ? `user=${user.id}` : 'no user');
	}

	// ── Redirect guards (flat, early-return) ─────────────────────────────

	// Guard 1: Protected route without auth → login
	if (isAdmin && !user) {
		redirect(303, '/login');
	}

	if (!isPublic && !user && !apiOffline) {
		redirect(303, '/login');
	}

	// Guard 2: Authenticated user on login/signup → home
	if (user && (matchesExactOrPrefix(routePath, '/login') || matchesExactOrPrefix(routePath, '/signup'))) {
		redirect(303, '/');
	}

	// Guard 3: Non-admin on admin routes → home
	if (isAdmin && user) {
		const hasAdminPermission = user?.permissions?.includes('admin:view');
		if (!hasAdminPermission) {
			redirect(303, '/');
		}
	}

	const response = await resolve(event);
	if (!isPublic && event.request.headers.get('sec-fetch-dest') === 'document') {
		response.headers.set('Cache-Control', 'no-store, max-age=0');
		response.headers.set('Pragma', 'no-cache');
	}
	return response;
};

export const handleDevtoolsJson: Handle = ({ event, resolve }) => {
	if (dev && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
		return new Response(undefined, { status: 204 });
	}

	return resolve(event);
};

export const handle: Handle = sequence(
	handleParaglide,
	handleTheme,
	handleAuth,
	handleDevtoolsJson
);

// ─── Error Handler ───────────────────────────────────────────────────────────

/**
 * Server-side error handler
 * Logs errors and returns user-friendly messages
 */
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	console.error('[Server Error]', {
		error,
		status,
		message,
		url: event.url.pathname,
		timestamp: new Date().toISOString()
	});

	return {
		message: status === 404 ? 'Page not found' : 'An unexpected error occurred',
		code: status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR'
	};
};
