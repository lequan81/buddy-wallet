/**
 * Application Types
 *
 * General types used across the frontend application.
 */

// ============================================
// Theme & Preferences
// ============================================

export type Theme = 'light' | 'dark';
export type Locale = 'en' | 'vi';

export interface UserPreferences {
	theme: Theme;
	locale: Locale;
}

// ============================================
// Notification Types
// ============================================

export type NotificationPermissionState = NotificationPermission | 'unsupported';

export interface PushSubscriptionData {
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
	sessionId?: string;
}

// ============================================
// UI State Types
// ============================================

export interface LoadingState {
	isLoading: boolean;
	error: string | null;
}


export interface HealthResponse {
	status: 'ok';
	onlineUsers: number;
}
