/**
 * Type-only export of the Elysia App instance
 * Used internally and by frontends via package.json exports
 */
export type App = typeof import('./index').app;

