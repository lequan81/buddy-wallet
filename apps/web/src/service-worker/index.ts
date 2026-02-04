/// <reference lib="webworker" />
/// <reference types="vite/client" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />

/**
 * Service Worker Entry Point (InjectManifest Strategy)
 *
 * This service worker uses Workbox's injectManifest strategy which allows
 * full control over caching strategies while still using Workbox's precaching.
 *
 * Structure:
 * - caching.ts: Network-only for API, Cache-first for static assets
 * - push-notifications.ts: Web Push notification handlers with subscription management
 */

import { clientsClaim } from 'workbox-core';

// Import caching strategies (handles precaching and routing)
import './caching';

// Import push notification handlers
import './push-notifications';

// Cast self to ServiceWorkerGlobalScope for proper typing
const sw = self as unknown as ServiceWorkerGlobalScope;

// Service worker version for debugging
const SW_VERSION = '1.0.0';

// Take control of all clients immediately
clientsClaim();

// Log service worker activation
sw.addEventListener('activate', (event) => {
	console.log(`[SW v${SW_VERSION}] Service worker activated`);
	event.waitUntil(sw.clients.claim());
});

// Handle skip waiting message from app
sw.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});

// Log service worker installation
sw.addEventListener('install', (event) => {
	console.log(`[SW v${SW_VERSION}] Service worker installing...`);
	// Skip waiting to activate immediately
	event.waitUntil(sw.skipWaiting());
});
