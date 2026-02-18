// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare module '~icons/*' {
	import { SvelteComponent } from 'svelte';
	export default class extends SvelteComponent<
		import('svelte/elements').SVGAttributes<SVGSVGElement>
	> {}
}

import 'vite-plugin-pwa/svelte';
import 'vite-plugin-pwa/info';
import 'vite-plugin-pwa/client';

import type { createTreatyClient } from '$lib/eden';

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
				email: string;
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
			/** Pre-configured API client with valid token */
			api: ReturnType<typeof createTreatyClient>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
