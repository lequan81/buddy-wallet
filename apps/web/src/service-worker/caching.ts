/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

/**
 * Initialize caching strategies for the service worker
 * - Cleans up outdated caches from previous versions
 * - Precaches assets from the build manifest
 */
export function initCaching(): void {
	// Cleanup outdated caches from previous versions
	cleanupOutdatedCaches();

	// Precache and route assets from the build manifest
	// self.__WB_MANIFEST is injected by vite-plugin-pwa during build
	precacheAndRoute(self.__WB_MANIFEST);
}
