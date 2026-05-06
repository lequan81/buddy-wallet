// src/hooks.ts
import { deLocalizeHref } from '$lib/paraglide/runtime';

// Empty transport export to silence SvelteKit warning
// See: https://svelte.dev/docs/kit/hooks#Shared-hooks-transport
export const transport = {};

/** @type {import('@sveltejs/kit').Reroute} */
export function reroute({ url }: { url: URL }) {
	// deLocalizeHref sẽ biến '/gioi-thieu' thành '/about' để SvelteKit tìm đúng file route
	return deLocalizeHref(url.pathname);
}
