export type PushPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface PushState {
	permission: PushPermissionState;
	isSubscribed: boolean;
	isLoading: boolean;
	error: string | null;
	vapidPublicKey: string | null;
}
