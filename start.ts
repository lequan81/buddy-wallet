// Unified production server - runs API + Web on single port
import { app } from './apps/api/src/index'; // Elysia app instance (exported)
import { getHandler } from './apps/web/build/handler';

const port = process.env.PORT || 3000;
const { fetch: skFetch } = getHandler();

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    // Route API paths to Elysia
    if (url.pathname.startsWith('/v1/') || url.pathname === '/health') {
      return app.fetch(req);
    }
    // Everything else → SvelteKit
    return skFetch(req);
  }
});

console.log(`Unified server running on http://localhost:${port}`);
