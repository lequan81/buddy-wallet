/**
 * Actor Plugin - Elysia Plugin for Authentication Context
 *
 * Provides a standardized 'actor' (current authenticated user) to the request context.
 * This plugin extends Elysia's context with user identity and permissions.
 *
 * Features:
 * - Derives 'actor' and 'permissions' from session-authenticated user
 * - Converts database user to UserResponse (removes sensitive fields)
 * - Provides 'requireActor' macro for protected routes
 * - Provides 'requirePermission' macro for permission-based access control
 * - Returns 401 automatically when authentication is required but missing
 * - Returns 403 automatically when permission is missing
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
 *
 * // Permission-based access
 * app.post('/admin/users', handler, {
 *   requirePermission: 'admin:manage-user'
 * });
 * ```
 *
 * @see sessionAuth - Underlying session authentication
 */

import { Elysia } from 'elysia';
import { sessionAuth } from './session-auth.plugin';
import { BE_ERRORS } from '@repo/errors';
import { apiError } from '@/commons/http/response';
import { toUserResponse } from '@/commons/security/password';
import { hasPermission, hasAnyPermission } from '@/commons/security/permissions';
import type { Permission } from '@/commons/security/permissions';
import type { UserResponse } from '@repo/types';

/**
 * Context available to routes using the requireActor/requirePermission macros
 */
export interface ActorContext {
  actor: UserResponse | null;
  permissions: string[];
  set: { status: number };
}

/**
 * Actor plugin instance
 *
 * Extends Elysia context with:
 * - `actor`: UserResponse | null - The authenticated user (or null)
 * - `permissions`: string[] - User's permission array
 *
 * Macros:
 * - `requireActor(true)`: Enforces authentication, returns 401 if missing
 * - `requirePermission('permission')`: Enforces auth + permission, returns 401/403
 */
export const actor = new Elysia({ name: 'Actor' })
  .use(sessionAuth)
  .derive({ as: 'global' }, ({ user }): { actor: UserResponse | null; permissions: string[] } => {
    if (!user) {
      return { actor: null, permissions: [] };
    }

    // Map to safe domain user (removes password hash, MFA secrets, etc.)
    const userResp = toUserResponse(user as unknown as Record<string, unknown>) as UserResponse;
    return { actor: userResp, permissions: userResp.permissions || [] };
  })
  .macro(({ onBeforeHandle }: { onBeforeHandle: (fn: (ctx: ActorContext) => unknown) => void }) => ({
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
    },

    /**
     * Require the authenticated user to have a specific permission.
     * Throws 401 if not authenticated, 403 if permission missing.
     *
     * @param permission - Single permission string or array of permissions (any match)
     * @example
     * .requirePermission('admin:view') // Requires admin:view permission
     * .requirePermission(['debt:create', 'debt:view-own']) // Requires any of these
     */
    requirePermission(this: void, permission: Permission | Permission[]) {
      const required = Array.isArray(permission) ? permission : [permission];

      onBeforeHandle((ctx: ActorContext) => {
        // First check authentication
        if (!ctx.actor) {
          ctx.set.status = 401;
          return apiError(BE_ERRORS.AUTH_NO_SESSION);
        }

        // Then check permission
        const hasAccess = required.length === 1
          ? hasPermission(ctx.permissions, required[0])
          : hasAnyPermission(ctx.permissions, required);

        if (!hasAccess) {
          ctx.set.status = 403;
          return apiError(BE_ERRORS.PERMISSION_DENIED);
        }
      });
    }
  }));
