// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import 'vite-plugin-pwa/svelte';
import 'vite-plugin-pwa/info';
import 'vite-plugin-pwa/client';

import type { createTreatyClient } from '$lib/services/api';

declare global {
	namespace App {
		interface Error {
			code: string | number;
			message: string;
		}
		interface Locals {
			theme: 'light' | 'dark';
			apiOffline: boolean;
			user: {
				id: string;
				name: string;
				email: string | null;
				role: string;
				permissions: string[];
				phoneNumber: string;
				emailVerified?: boolean;
				emailNotificationsEnabled?: boolean;
				pushNotificationsEnabled?: boolean;
				mustChangePassword?: boolean;
			} | null;
			/** Current access token (valid after refresh if needed) */
			accessToken: string | undefined;
			/** Pre-configured API client with valid token (only created when auth is resolved) */
			api: ReturnType<typeof createTreatyClient>;
			/** Cookie-sniff signal: true if session/refresh cookies exist (no API call needed) */
			hasSession: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
