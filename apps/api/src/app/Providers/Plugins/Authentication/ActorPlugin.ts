/**
 * Actor Plugin - Elysia Plugin for Authentication Context
 *
 * Provides a standardized 'actor' (current authenticated user) to the request context.
 * This plugin extends Elysia's context with user identity and permissions.
 *
 * Features:
 * - Derives 'actor' and 'permissions' from session-authenticated user
 * - Converts database user to SafeUser (removes sensitive fields)
 * - Provides 'requireActor' macro for protected routes
 * - Returns 401 automatically when authentication is required but missing
 *
 * Usage:
 * ```typescript
 * // Apply plugin to route group
 * app.group('/api', (group) =>
 *   group
 *     .use(actor)
 *     .requireActor(true) // All routes in this group require auth
 *     .get('/profile', ({ actor }) => ({ name: actor.name }))
 * );
 * ```
 *
 * @see sessionAuth - Underlying session authentication
 */

import { Elysia } from 'elysia';
import { sessionAuth } from './SessionAuthPlugin';
import { BE_ERRORS } from '@repo/errors';
import { apiError } from '@/lib/http';
import { toSafeUser } from '@/lib/mappers/user';
import type { SafeUser } from '@repo/types';

/**
 * Context available to routes using the requireActor macro
 */
interface ActorContext {
  actor: SafeUser | null;
  set: { status: number | string };
}

/**
 * Actor plugin instance
 *
 * Extends Elysia context with:
 * - `actor`: SafeUser | null - The authenticated user (or null)
 * - `permissions`: string[] - User's permission array
 *
 * Macro:
 * - `requireActor(true)`: Enforces authentication, returns 401 if missing
 */
export const actor = new Elysia({ name: 'Actor' })
  .use(sessionAuth)
  .derive({ as: 'global' }, ({ user }): { actor: SafeUser | null; permissions: string[] } => {
    if (!user) {
      return { actor: null, permissions: [] };
    }

    // Map to safe domain user (removes password hash, MFA secrets, etc.)
    const safeUser = toSafeUser(user);
    return { actor: safeUser, permissions: safeUser.permissions };
  })
  .macro(({ onBeforeHandle }) => ({
    /**
     * Require a valid authenticated actor to access this route.
     * Throws 401 if no user is found.
     *
     * @param active - Set to true to require authentication
     * @example
     * .requireActor(true) // Route requires auth
     * .requireActor(false) // Route is optional (default)
     */
    requireActor(this: void, active: boolean) {
      if (!active) return;

      onBeforeHandle((ctx: ActorContext) => {
        if (!ctx.actor) {
          ctx.set.status = 401;
          return apiError(BE_ERRORS.AUTH_NO_SESSION);
        }
      });
    }
  }));
