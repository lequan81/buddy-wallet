/**
 * Push Notification Helper
 *
 * Client-side utilities for managing Web Push notifications:
 * - Permission management
 * - Subscription handling
 * - VAPID key retrieval
 */

import { api } from '$lib/services/api';
import { getDeviceInfo } from '$lib/utils/device';
import { getCookie, setCookie, deleteCookie } from '$lib/utils/cookie-utils';

const COOKIE_KEYS = {
	PUSH_BANNER_DISMISSED: 'bw-push-dismissed',
	PUSH_BANNER_DISMISSED_UNTIL: 'bw-push-dismissed-until'
} as const;

// Push notification state
import type { PushPermissionState, PushState } from '$lib/types';

export type { PushPermissionState, PushState };

// Reactive state using runes
export const pushState = $state<PushState>({
	permission: 'prompt',
	isSubscribed: false,
	isLoading: false,
	error: null,
	vapidPublicKey: null
});

// Check if push notifications are supported
export function isPushSupported(): boolean {
	return (
		typeof window !== 'undefined' &&
		window.isSecureContext &&
		'serviceWorker' in navigator &&
		'PushManager' in window &&
		'Notification' in window
	);
}

// Get current notification permission
export function getPermissionState(): PushPermissionState {
	if (!isPushSupported()) return 'unsupported';
	return Notification.permission as PushPermissionState;
}

// Initialize push state
export async function initializePushState(): Promise<void> {
	if (!isPushSupported()) {
		pushState.permission = 'unsupported';
		return;
	}

	const permission = getPermissionState();
	let isSubscribed = false;

	if (permission === 'granted') {
		// Check if already subscribed
		try {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();
			isSubscribed = !!subscription;
		} catch {
			// Ignore errors
		}
	}

	pushState.permission = permission;
	pushState.isSubscribed = isSubscribed;
}

// Fetch VAPID public key from server
export async function fetchVapidKey(): Promise<string | null> {
	if (pushState.vapidPublicKey) {
		return pushState.vapidPublicKey;
	}

	try {
		const { data, error } = await api.v1.push['vapid-key'].get();
		const vapidData = (data as { data?: { publicKey?: string }; publicKey?: string })?.data || data;

		if (error || !vapidData?.publicKey) {
			pushState.error = error ? ((error.value as { message?: string })?.message || 'Failed to fetch VAPID key') : 'Failed to fetch VAPID key';
			return null;
		}

		pushState.vapidPublicKey = vapidData.publicKey;
		pushState.error = null;
		return vapidData.publicKey as string;
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Failed to fetch VAPID key';
		pushState.error = errorMsg;
		return null;
	}
}

// Convert URL-safe base64 to Uint8Array (for VAPID key)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

// Convert ArrayBuffer to base64url
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Request notification permission
export async function requestPermission(): Promise<PushPermissionState> {
	if (!isPushSupported()) return 'unsupported';

	pushState.isLoading = true;
	pushState.error = null;

	try {
		const permission = await Notification.requestPermission();
		pushState.permission = permission as PushPermissionState;
		pushState.isLoading = false;
		return permission as PushPermissionState;
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Failed to request permission';
		pushState.isLoading = false;
		pushState.error = errorMsg;
		return 'denied';
	}
}

// Get device info for subscription

// Subscribe to push notifications
export async function subscribeToPush(): Promise<boolean> {
	if (!isPushSupported()) return false;

	pushState.isLoading = true;
	pushState.error = null;

	try {
		// Request permission if not granted
		const permission = getPermissionState();
		if (permission !== 'granted') {
			const newPermission = await requestPermission();
			if (newPermission !== 'granted') {
				pushState.isLoading = false;
				return false;
			}
		}

		// Get VAPID key
		const vapidKey = await fetchVapidKey();
		if (!vapidKey) {
			pushState.isLoading = false;
			pushState.error = 'Push notifications not configured on server';
			return false;
		}

		// Get service worker registration
		const registration = await navigator.serviceWorker.ready;

		// Subscribe to push
		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource
		});

		// Get subscription keys
		const p256dhKey = subscription.getKey('p256dh');
		const authKey = subscription.getKey('auth');

		if (!p256dhKey || !authKey) {
			throw new Error('Failed to get subscription keys');
		}

		// Get device info
		const { deviceName, deviceType } = getDeviceInfo();

		// Send subscription to server
		const { error } = await (api.v1.push.subscribe as any).post({
				endpoint: subscription.endpoint,
				keys: {
					p256dh: arrayBufferToBase64Url(p256dhKey),
					auth: arrayBufferToBase64Url(authKey)
				},
				expirationTime: subscription.expirationTime?.toString() || null,
				deviceName,
				deviceType
			});

		if (error) {
			throw new Error('Failed to save subscription on server');
		}

		pushState.isSubscribed = true;
		pushState.isLoading = false;
		pushState.error = null;

		return true;
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Failed to subscribe';
		pushState.isLoading = false;
		pushState.error = errorMsg;
		return false;
	}
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(): Promise<boolean> {
	if (!isPushSupported()) return false;

	pushState.isLoading = true;
	pushState.error = null;

	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();

		if (!subscription) {
			pushState.isSubscribed = false;
			pushState.isLoading = false;
			return true;
		}

		// Unsubscribe locally
		await subscription.unsubscribe();

		// Remove from server
		await api.v1.push.unsubscribe.post({ endpoint: subscription.endpoint });

		pushState.isSubscribed = false;
		pushState.isLoading = false;
		pushState.error = null;

		return true;
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Failed to unsubscribe';
		pushState.isLoading = false;
		pushState.error = errorMsg;
		return false;
	}
}

// Send test notification
export async function sendTestNotification(): Promise<boolean> {
	try {
		const { error } = await api.v1.push.test.post();
		return !error;
	} catch {
		return false;
	}
}

// Check if banner should be shown (not dismissed, permission is 'prompt')

export function shouldShowBanner(): boolean {
	if (typeof window === 'undefined') return false;

	// Don't show if unsupported, already granted/denied, or already subscribed
	if (pushState.permission !== 'prompt' || pushState.isSubscribed) return false;

	// Check if permanently dismissed
	if (getCookie(COOKIE_KEYS.PUSH_BANNER_DISMISSED) === 'true') return false;

	// Check if temporarily dismissed
	const dismissedUntil = getCookie(COOKIE_KEYS.PUSH_BANNER_DISMISSED_UNTIL);
	if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) return false;

	return true;
}

export function dismissBanner(permanent = false): void {
	if (permanent) {
		setCookie(COOKIE_KEYS.PUSH_BANNER_DISMISSED, 'true', 365);
	} else {
		// Dismiss for 7 days
		const dismissUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
		setCookie(COOKIE_KEYS.PUSH_BANNER_DISMISSED_UNTIL, dismissUntil.toString(), 7);
	}
}

export function resetBannerDismissal(): void {
	deleteCookie(COOKIE_KEYS.PUSH_BANNER_DISMISSED);
	deleteCookie(COOKIE_KEYS.PUSH_BANNER_DISMISSED_UNTIL);
}
