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
import { db, users, sessions, eq, and } from '@repo/db';

const app = new Elysia()
  .use(corsPlugin)
  .use(csrfPlugin) // Global CSRF Protection
  .group('/v1', (app) =>
    app
      .use(jwtPlugin)
      // Enhanced auth with session status check (Facebook/Instagram style)
      .derive(async ({ jwt, bearer, cookie }) => {
        let token = bearer;

        // Fallback to session cookie
        if (!token && cookie?.session?.value) {
          token = String(cookie.session.value);
        }

        if (!token) {
          return { user: null };
        }

        const payload = await jwt.verify(token);
        if (!payload) {
          return { user: null };
        }

        // Check if session is still active (not revoked/logged out)
        const session = db.select()
          .from(sessions)
          .where(
            and(
              eq(sessions.userId, payload.id),
              eq(sessions.accessToken, token),
              eq(sessions.status, 'active') // Only allow active sessions
            )
          )
          .get();

        if (!session) {
          // Token is valid but session was revoked
          console.log(`[BE] Session revoked or not found for user: ${payload.id}`);
          return { user: null };
        }

        // Update last active time (fire and forget, don't block response)
        db.update(sessions)
          .set({ lastActiveAt: new Date() })
          .where(eq(sessions.id, session.id))
          .run();

        const user = db.select().from(users).where(eq(users.id, payload.id)).get();

        // Check if user is active
        if (user && !user.isActive) {
          console.log(`[BE] User account deactivated: ${user.email}`);
          return { user: null };
        }

        return { user: user || null };
      })
      .use(authController)
      .use(publicController) // /v1/check-debt
      .use(permissionPlugin)
      // Guarded Routes (Require Authentication)
      .guard(
        {
          beforeHandle: (ctx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { user, set } = ctx as any;
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
