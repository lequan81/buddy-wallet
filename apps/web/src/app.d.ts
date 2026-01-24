// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
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
				email: string;
				role: string;
				permissions: string[];
				phoneNumber?: string | null;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
