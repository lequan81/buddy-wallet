/**
 * Client-side hooks
 *
 * - init(): Runs once before hydration — preloads fonts, preconnects to API,
 *           prefetches dashboard for logged-in users, detects network quality,
 *           and optionally initializes analytics.
 * - handleError(): Catches unhandled client errors, logs them, and sends
 *                  to error tracking (fire-and-forget).
 */
import { dev } from '$app/environment';
import type { HandleClientError } from '@sveltejs/kit';

// ============================================================
// Error Tracking
// ============================================================

interface ErrorReport {
	error: unknown;
	status?: number;
	url: string;
}

/**
 * Send error data to a tracking endpoint.
 *
 * - In development: Logs a structured error to the console.
 * - In production: POSTs to `/v1/errors/client` (fire-and-forget).
 *
 * NOTE: The `/v1/errors/client` endpoint does not exist yet.
 *       When you create it, errors will start flowing automatically.
 *       Until then, production errors are silently dropped (no crash).
 */
async function sendToErrorTracking({ error, status, url }: ErrorReport): Promise<void> {
	const payload = {
		message: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
		status,
		url,
		timestamp: new Date().toISOString(),
		userAgent: navigator.userAgent
	};

	if (dev) {
		console.warn('[ErrorTracking] Would send:', payload);
		return;
	}

	// Fire-and-forget: don't await, don't crash if endpoint is missing
	try {
		const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
		fetch(`${apiUrl}/v1/errors/client`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			keepalive: true // Ensures the request survives page navigation
		}).catch(() => {
			// Silently ignore — endpoint may not exist yet
		});
	} catch {
		// Silently ignore
	}
}

// ============================================================
// Analytics (commented out — uncomment when ready)
// ============================================================

// ── [ANALYTICS:GA] Google Analytics 4 ──────────────────────
// To activate:
//   1. Set VITE_GA_MEASUREMENT_ID in your .env (e.g., G-XXXXXXXXXX)
//   2. Uncomment the code blocks marked [ANALYTICS:GA]
//
// function initGoogleAnalytics(): void {
// 	const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
// 	if (!measurementId) return;
//
// 	// Load gtag.js script
// 	const script = document.createElement('script');
// 	script.async = true;
// 	script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
// 	document.head.appendChild(script);
//
// 	// Initialize dataLayer and gtag function
// 	window.dataLayer = window.dataLayer || [];
// 	function gtag(...args: unknown[]) {
// 		// eslint-disable-next-line @typescript-eslint/no-explicit-any
// 		(window.dataLayer as any[]).push(args);
// 	}
// 	gtag('js', new Date());
// 	gtag('config', measurementId, {
// 		// Disable automatic page_view since SvelteKit handles SPA navigation
// 		send_page_view: false
// 	});
//
// 	// Track SPA navigations via SvelteKit's afterNavigate
// 	// Import { afterNavigate } from '$app/navigation' at the top of the file
// 	// afterNavigate(() => {
// 	// 	gtag('event', 'page_view', {
// 	// 		page_path: window.location.pathname,
// 	// 		page_title: document.title
// 	// 	});
// 	// });
// }

// ── [ANALYTICS:CF] Cloudflare Web Analytics ────────────────
// To activate:
//   1. Set VITE_CF_BEACON_TOKEN in your .env
//   2. Uncomment the code blocks marked [ANALYTICS:CF]
//
// function initCloudflareAnalytics(): void {
// 	const beaconToken = import.meta.env.VITE_CF_BEACON_TOKEN;
// 	if (!beaconToken) return;
//
// 	const script = document.createElement('script');
// 	script.defer = true;
// 	script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
// 	script.dataset.cfBeacon = JSON.stringify({ token: beaconToken, spa: true });
// 	document.head.appendChild(script);
// }

// ============================================================
// Network Quality Detection
// ============================================================

/**
 * Detects network quality and sets a data attribute on <html> so
 * components can adapt (e.g., skip animations, use lower-quality images).
 *
 * Usage in Svelte components:
 *   - CSS: `html[data-slow-network="true"] .heavy-animation { animation: none; }`
 *   - JS: `document.documentElement.dataset.slowNetwork === 'true'`
 */
function detectNetworkQuality(): void {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const conn = (navigator as any).connection;
	if (!conn) return;

	const updateNetworkStatus = () => {
		const isSlow = conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.saveData;
		document.documentElement.dataset.slowNetwork = isSlow ? 'true' : 'false';

		if (dev && isSlow) {
			console.warn('[Network] Slow connection detected:', conn.effectiveType);
		}
	};

	updateNetworkStatus();
	conn.addEventListener('change', updateNetworkStatus);
}

// ============================================================
// Dashboard Prefetch (for PWA / mobile browser)
// ============================================================

/**
 * If the user has a session cookie, they're likely logged in and
 * will navigate to /dashboard next. Prefetch it so the transition
 * feels instant — especially important for PWA on mobile.
 *
 * Uses `priority: 'low'` and `keepalive` to avoid competing with
 * critical resources during hydration.
 */
function prefetchDashboardIfLoggedIn(): void {
	const hasSession = document.cookie.includes('session=');
	const isAlreadyOnDashboard = window.location.pathname.startsWith('/dashboard');
	const isOnAuthPage =
		window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/signup');

	// Only prefetch if logged in AND not already on dashboard
	if (hasSession && !isAlreadyOnDashboard && !isOnAuthPage) {
		fetch('/dashboard', {
			credentials: 'same-origin',
			priority: 'low'
		}).catch(() => {
			// Silently ignore — this is a best-effort optimization
		});
	}
}

// ============================================================
// Client Init Hook (runs once before hydration)
// ============================================================

/**
 * Initializes the client-side environment before the app hydrates.
 *
 * This runs ONCE and is the ideal place for:
 * - Warming DNS/TCP/TLS connections (preconnect)
 * - Programmatically preloading fonts
 * - Detecting network quality
 * - Prefetching likely-next-page data
 * - Initializing analytics (non-blocking)
 */
export const init = async () => {
	// ── Critical (runs immediately) ────────────────────────

	// 1. Preconnect to API server (saves ~100-300ms on first API call)
	const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
	try {
		const apiOrigin = new URL(apiUrl).origin;
		const link = document.createElement('link');
		link.rel = 'preconnect';
		link.href = apiOrigin;
		document.head.appendChild(link);
	} catch {
		// Invalid URL — skip preconnect
	}

	// 2. Programmatic font warming (loads font into browser cache early)
	//    The CSS @font-face is already loaded via app.html <link>,
	//    but this triggers the browser to actually download the font files
	//    before any text using the font is rendered.
	if (typeof document !== 'undefined' && document.fonts) {
		// Fire-and-forget: warm the most critical weights
		document.fonts.load('400 1em "Be Vietnam Pro"').catch(() => {});
		document.fonts.load('500 1em "Be Vietnam Pro"').catch(() => {});
		document.fonts.load('600 1em "Be Vietnam Pro"').catch(() => {});
		document.fonts.load('700 1em "Be Vietnam Pro"').catch(() => {});
	}

	// 3. Network quality detection (sets data-slow-network attribute)
	detectNetworkQuality();

	// ── Non-critical (deferred via requestIdleCallback) ────

	const deferredInit = () => {
		// 4. Prefetch dashboard for logged-in users (PWA / mobile)
		prefetchDashboardIfLoggedIn();

		// 5. Initialize analytics (uncomment when ready)
		// [ANALYTICS:GA]
		// initGoogleAnalytics();

		// [ANALYTICS:CF]
		// initCloudflareAnalytics();
	};

	// Schedule non-critical work when the browser is idle
	if ('requestIdleCallback' in window) {
		requestIdleCallback(deferredInit, { timeout: 3000 });
	} else {
		// Safari fallback
		setTimeout(deferredInit, 1);
	}
};

// ============================================================
// Client Error Handler
// ============================================================

export const handleError: HandleClientError = async ({ error, event, status, message }) => {
	// Always log to console
	console.error('[Client Error]', {
		error,
		status,
		message,
		url: event.url.pathname
	});

	// Send to error tracking (fire-and-forget, never blocks UI)
	sendToErrorTracking({ error, status, url: event.url.pathname });

	// Return user-friendly error
	return {
		message: 'An unexpected error occurred. Please refresh the page.',
		code: 'CLIENT_ERROR'
	};
};
