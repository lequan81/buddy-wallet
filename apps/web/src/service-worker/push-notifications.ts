/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope;

export interface PushNotificationData {
	title: string;
	body: string;
	icon?: string;
	url?: string;
	tag?: string;
	badge?: string;
	data?: Record<string, unknown>;
}

const DEFAULT_NOTIFICATION: PushNotificationData = {
	title: 'Buddy Wallet',
	body: 'New notification',
	icon: '/icons/pwa-192x192.png'
};

/**
 * Parse push event data into notification format
 */
function parsePushData(event: PushEvent): PushNotificationData {
	if (!event.data) {
		return DEFAULT_NOTIFICATION;
	}

	try {
		const data = event.data.json() as Partial<PushNotificationData>;
		return {
			title: data.title ?? DEFAULT_NOTIFICATION.title,
			body: data.body ?? DEFAULT_NOTIFICATION.body,
			icon: data.icon ?? DEFAULT_NOTIFICATION.icon,
			url: data.url,
			tag: data.tag,
			badge: data.badge,
			data: data.data
		};
	} catch {
		// If JSON parsing fails, use text as body
		return {
			...DEFAULT_NOTIFICATION,
			body: event.data.text() || DEFAULT_NOTIFICATION.body
		};
	}
}

/**
 * Handle incoming push notifications
 */
function handlePush(event: PushEvent): void {
	const notification = parsePushData(event);

	event.waitUntil(
		self.registration.showNotification(notification.title, {
			body: notification.body,
			icon: notification.icon,
			tag: notification.tag,
			badge: notification.badge,
			data: {
				url: notification.url,
				...notification.data
			}
		})
	);
}

/**
 * Handle notification click events
 */
function handleNotificationClick(event: NotificationEvent): void {
	event.notification.close();

	const urlToOpen = (event.notification.data?.url as string) || '/';

	event.waitUntil(
		self.clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then((clientList) => {
				// Try to focus an existing window
				for (const client of clientList) {
					if ('focus' in client) {
						return client.focus();
					}
				}
				// Open a new window if none exists
				return self.clients.openWindow(urlToOpen);
			})
	);
}

/**
 * Initialize push notification handlers
 */
export function initPushNotifications(): void {
	self.addEventListener('push', handlePush);
	self.addEventListener('notificationclick', handleNotificationClick);
}
