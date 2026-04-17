/**
 * Push Notification Handlers Module
 *
 * Handles Web Push notifications in the service worker:
 * - Receiving and displaying push messages
 * - Handling notification actions (click, close)
 * - Managing subscription lifecycle
 * - Deep linking from notifications
 */

/// <reference lib="webworker" />

// Cast self to ServiceWorkerGlobalScope for proper typing
const sw = self as unknown as ServiceWorkerGlobalScope;

// Backend API base URL (injected at build time via Vite; use Bun/env for the app)
const API_BASE =
	(typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
	'';

// Default notification configuration
const DEFAULT_NOTIFICATION = {
	title: 'Buddy Wallet',
	body: 'You have a new notification',
	icon: '/icons/pwa-192x192.png',
	badge: '/icons/pwa-192x192.png'
};

// Notification action types
type NotificationAction = 'view' | 'dismiss' | 'reply';

interface PushPayload {
	title?: string;
	body?: string;
	icon?: string;
	badge?: string;
	tag?: string;
	url?: string;
	actions?: Array<{ action: NotificationAction; title: string; icon?: string }>;
	data?: Record<string, unknown>;
	requireInteraction?: boolean;
	silent?: boolean;
}

// ============================================
// Push Event Handlers
// ============================================

// Handle incoming push notifications
sw.addEventListener('push', (event) => {
	let payload: PushPayload = { ...DEFAULT_NOTIFICATION };

	if (event.data) {
		try {
			const jsonData = event.data.json() as PushPayload;
			payload = { ...payload, ...jsonData };
		} catch {
			// If not JSON, use text as body
			payload.body = event.data.text();
		}
	}

	const options: NotificationOptions = {
		body: payload.body,
		icon: payload.icon,
		badge: payload.badge,
		tag: payload.tag || `notification-${Date.now()}`,
		requireInteraction: payload.requireInteraction ?? false,
		silent: payload.silent ?? false,
		data: {
			url: payload.url || '/',
			timestamp: Date.now(),
			...payload.data
		}
	};

	event.waitUntil(
		sw.registration.showNotification(payload.title || DEFAULT_NOTIFICATION.title, options)
	);
});

// ============================================
// Notification Click Handlers
// ============================================

// Handle notification click
sw.addEventListener('notificationclick', (event) => {
	const notification = event.notification;
	const action = event.action;
	const notificationData = notification.data || {};

	// Always close the notification
	notification.close();

	// Handle dismiss action
	if (action === 'dismiss') {
		return;
	}

	// Get target URL from notification data
	const targetUrl = notificationData.url || '/';

	event.waitUntil(
		(async () => {
			// Try to find an existing window/tab with the app
			const windowClients = await sw.clients.matchAll({
				type: 'window',
				includeUncontrolled: true
			});

			// Check if app is already open
			for (const client of windowClients) {
				const clientUrl = new URL(client.url);
				// If app is already open, navigate to target URL and focus
				if (clientUrl.origin === sw.location.origin) {
					if ('navigate' in client) {
						await (client as WindowClient).navigate(targetUrl);
					}
					return client.focus();
				}
			}

			// No existing window, open a new one
			if (sw.clients.openWindow) {
				return sw.clients.openWindow(targetUrl);
			}
		})()
	);
});

// Handle notification close (no proxy; backend has no notifications/track route)
sw.addEventListener('notificationclose', () => {
	// Optional: track close via backend when/if that endpoint exists
});

// ============================================
// Subscription Management
// ============================================

// Helper function to convert ArrayBuffer to Base64 URL-safe string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Handle push subscription change (browser-initiated renewal)
sw.addEventListener('pushsubscriptionchange', ((event: Event) => {
	const extendableEvent = event as ExtendableEvent & {
		oldSubscription?: PushSubscription;
		newSubscription?: PushSubscription;
	};

	extendableEvent.waitUntil(
		(async () => {
			try {
				// Try to get new subscription or re-subscribe
				let subscription = extendableEvent.newSubscription;

				if (!subscription) {
					// Re-subscribe with same options
					subscription = await sw.registration.pushManager.subscribe({
						userVisibleOnly: true
						// applicationServerKey should be provided by the app
						// This is a fallback; the app should handle re-subscription
					});
				}

				if (!subscription) {
					console.warn('[SW] Could not re-subscribe to push notifications');
					return;
				}

				// Get the keys
				const p256dhKey = subscription.getKey('p256dh');
				const authKey = subscription.getKey('auth');

				if (!p256dhKey || !authKey) {
					console.warn('[SW] Subscription keys not available');
					return;
				}

				// Send new subscription to backend API directly (no proxy)
				const url = API_BASE ? `${API_BASE.replace(/\/$/, '')}/v1/push/subscribe` : '';
				if (!url) {
					console.warn('[SW] VITE_API_URL not set; cannot update push subscription');
					return;
				}
				const response = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						endpoint: subscription.endpoint,
						expirationTime: subscription.expirationTime,
						keys: {
							p256dh: arrayBufferToBase64(p256dhKey),
							auth: arrayBufferToBase64(authKey)
						},
						oldEndpoint: extendableEvent.oldSubscription?.endpoint
					})
				});

				if (!response.ok) {
					console.error('[SW] Failed to update push subscription on server');
				}
			} catch (error) {
				console.error('[SW] Push subscription change handling failed:', error);
			}
		})()
	);
}) as EventListener);

// ============================================
// Message Handlers (Communication with Main App)
// ============================================

// Handle messages from the main application
sw.addEventListener('message', (event) => {
	const { type, data: messageData } = event.data || {};

	switch (type) {
		case 'SHOW_NOTIFICATION':
			// Allow app to trigger notifications through service worker
				if (messageData?.title) {
					const notificationData = messageData.data;
					sw.registration.showNotification(messageData.title, {
						body: messageData.body,
						icon: messageData.icon || DEFAULT_NOTIFICATION.icon,
						badge: messageData.badge || DEFAULT_NOTIFICATION.badge,
						data: notificationData
				});
			}
			break;

		case 'GET_SUBSCRIPTION':
			// Return current push subscription to the app
			event.waitUntil(
				(async () => {
					const subscription = await sw.registration.pushManager.getSubscription();
					if (event.source) {
						(event.source as Client).postMessage({
							type: 'SUBSCRIPTION_RESULT',
							subscription: subscription ? JSON.parse(JSON.stringify(subscription)) : null
						});
					}
				})()
			);
			break;

		case 'CLEAR_NOTIFICATIONS':
			// Clear all notifications with optional tag filter
			event.waitUntil(
					sw.registration.getNotifications({ tag: messageData?.tag }).then((notifications) => {
					notifications.forEach((n) => n.close());
				})
			);
			break;
	}
});
