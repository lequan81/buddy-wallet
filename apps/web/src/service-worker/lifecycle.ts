/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope;

/**
 * Handle service worker lifecycle events
 */
export function initLifecycle(): void {
	// Skip waiting when requested by the client
	self.addEventListener('message', (event) => {
		if (event.data && event.data.type === 'SKIP_WAITING') {
			self.skipWaiting();
		}
	});

	// Claim clients immediately after activation
	self.addEventListener('activate', (event) => {
		event.waitUntil(self.clients.claim());
	});
}
