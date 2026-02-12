/**
 * Caching Strategies Module (InjectManifest)
 *
 * Configures Workbox caching strategies for the service worker.
 * - Network-Only: All API requests (always fresh data)
 * - Cache-First: Static assets (images, fonts)
 * - StaleWhileRevalidate: App shell and pages
 */

/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Cast self to ServiceWorkerGlobalScope for proper typing
const sw = self as unknown as ServiceWorkerGlobalScope;

// Precache and route assets injected by Workbox at build time
// self.__WB_MANIFEST is replaced with the actual precache manifest
// In development, it may be undefined, so we provide a fallback empty array
const manifest = sw.__WB_MANIFEST;
if (Array.isArray(manifest) && manifest.length > 0) {
	precacheAndRoute(manifest);
}

// Clean up outdated caches from previous service worker versions
cleanupOutdatedCaches();

// ============================================
// Network-Only (never cache - real-time data)
// ============================================

// All API endpoints should use NetworkOnly
// This ensures fresh data and prevents stale cache issues
registerRoute(
	({ url, request }) =>
		url.pathname.match(/\/(ws|socket|api\/ws)/) ||
		url.pathname.includes('/auth/') ||
		url.pathname.startsWith('/api/') ||
		url.pathname.startsWith('/v1/') ||
		request.method !== 'GET',
	new NetworkOnly()
);

// ============================================
// StaleWhileRevalidate (fast response, background update)
// ============================================

// Page navigations - serve cached, update in background
registerRoute(
	new NavigationRoute(
		new StaleWhileRevalidate({
			cacheName: 'pages-cache',
			plugins: [
				new ExpirationPlugin({
					maxEntries: 30,
					maxAgeSeconds: 60 * 60 * 24, // 24 hours
					purgeOnQuotaError: true
				}),
				// Only cache successful HTML responses
				new CacheableResponsePlugin({
					statuses: [200]
				})
			]
		}),
		{
			// Don't cache auth-related navigations
			denylist: [/\/login/, /\/logout/, /\/signup/]
		}
	)
);

// ============================================
// Cache-First (serve from cache, rarely changes)
// ============================================

// Static assets: images, fonts, icons
registerRoute(
	({ request, url }) =>
		request.destination === 'image' ||
		request.destination === 'font' ||
		url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$/i),
	new CacheFirst({
		cacheName: 'static-assets',
		plugins: [
			new ExpirationPlugin({
				maxEntries: 100,
				maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
				purgeOnQuotaError: true
			}),
			new CacheableResponsePlugin({
				statuses: [0, 200]
			})
		]
	})
);

// JavaScript and CSS bundles (versioned, can be cached long)
registerRoute(
	({ request, url }) =>
		(request.destination === 'script' || request.destination === 'style') &&
		!url.pathname.includes('sw.') && // Don't cache service worker
		!url.pathname.includes('workbox'),
	new CacheFirst({
		cacheName: 'js-css-cache',
		plugins: [
			new ExpirationPlugin({
				maxEntries: 50,
				maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
				purgeOnQuotaError: true
			}),
			new CacheableResponsePlugin({
				statuses: [0, 200]
			})
		]
	})
);

// ============================================
// Offline Fallback
// ============================================

// Provide offline fallback for navigation requests
sw.addEventListener('fetch', (event) => {
	if (event.request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					// Try network first
					return await fetch(event.request);
				} catch {
					// If offline, try to return cached page or a fallback
					const cache = await caches.open('pages-cache');
					const cachedResponse = await cache.match(event.request);
					if (cachedResponse) {
						return cachedResponse;
					}
					// Return app shell as fallback
					const fallback = await cache.match('/');
					if (fallback) {
						return fallback;
					}
					// Last resort: offline page
					return new Response('Offline - Please check your connection', {
						status: 503,
						headers: { 'Content-Type': 'text/html' }
					});
				}
			})()
		);
	}
});
