import { Elysia } from 'elysia';
import { configs } from '@/configs'; // Ensure env is loaded first
import { corsPlugin, csrfPlugin, jwtPlugin, permissionPlugin } from '@plugins';
import {
  authController,
  debtsController,
  exportController,
  importController,
  publicController,
  usersController
} from '@controllers';

const app = new Elysia()
  .use(corsPlugin)
  .use(csrfPlugin) // Global CSRF Protection
  .group('/v1', (app) =>
    app
      .use(jwtPlugin)
      // Debug logging
      .derive(({ request, user }) => {
        console.log(`[BE] ${request.method} ${request.url}`);
        if (user) console.log(`[DEBUG] User Authenticated: ${user.id}`);
        else console.log(`[DEBUG] User NOT Authenticated / Guest`);
      })
      .use(authController)
      .use(publicController) // /v1/check-debt
      .use(permissionPlugin)
      // Guarded Routes (Require Authentication)
      .guard(
        {
          beforeHandle: ({ user, set }) => {
            if (!user) {
              set.status = 401;
              return { success: false, message: 'Unauthorized' };
            }
          }
        },
        (app) =>
          app.use(usersController).use(debtsController).use(importController).use(exportController)
      )
  )
  .get('/health', () => ({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.2.4',
    memory: process.memoryUsage().heapUsed
  }))
  .listen(configs.PORT);

console.log(`[BE] Server is running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
