// Unified production server - runs API + Web on single port
import { app } from './apps/api/dist/index.js'; // Elysia app instance (built output)

import { handler } from './apps/web/build/handler.js';

const port = Bun.env.PORT || 3000;

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    // Route API paths to Elysia
    if (url.pathname.startsWith('/v1/') || url.pathname === '/health') {
      return app.fetch(req);
    }
    // Everything else → SvelteKit
    const response = await handler(req);
    if (response) return response;

    return new Response('Not found', { status: 404 });
  }
});

console.log(`Unified server running on http://localhost:${port}`);
