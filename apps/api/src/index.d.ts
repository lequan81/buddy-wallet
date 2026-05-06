/**
 * Type-only export of the Elysia App instance
 * Used internally and by frontends via package.json exports
 *
 * The App type is derived from createApp() in bootstrap.ts so that
 * Eden Treaty can infer the full route tree for type-safe client calls.
 */
import type { createApp } from './bootstrap';

export type App = ReturnType<typeof createApp>;
