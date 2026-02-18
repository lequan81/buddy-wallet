/**
 * Root layout configuration
 *
 * Applies to ALL routes. Settings here can be overridden by
 * child layout.ts files (e.g., (admin)/+layout.ts).
 */

/**
 * Enable native View Transitions API for SPA-like page navigations.
 *
 * When supported (Chrome 111+, Edge 111+), this creates smooth
 * crossfade transitions between pages. On unsupported browsers,
 * navigation works normally — no fallback needed.
 *
 * Combined with `data-sveltekit-preload-data="hover"` on <body>,
 * this makes navigations feel instant:
 * 1. User hovers a link → SvelteKit prefetches the page data
 * 2. User clicks → View Transition crossfades to the new page
 *
 * Customize transitions per-element with CSS:
 *   .hero-image { view-transition-name: hero; }
 *
 * @see https://svelte.dev/docs/kit/$app-navigation#onnavigate
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
 */
export const ssr = true;
