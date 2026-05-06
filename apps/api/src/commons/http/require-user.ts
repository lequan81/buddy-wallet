/**
 * Route-level authentication and authorization helpers.
 * @logicType backend
 *
 * Wraps handlers with authentication checks and optional permission enforcement.
 * These are used in route definitions as middleware wrappers.
 */

import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import { BE_ERRORS } from '@repo/errors';
import { apiError } from '@/commons/http/response';
import { hasPermission, hasAnyPermission } from '@/commons/security/permissions';
import type { Permission } from '@/commons/security/permissions';

type UserContext = {
  user?: {
    permissions?: Permission[];
  };
};

/**
 * Require an authenticated user to access this route.
 * Returns 401 if no user is found.
 */
export function requireUser<TBody, TParams, TQuery, TResult>(
  handler: (ctx: AuthenticatedHandlerContext<TBody, TParams, TQuery>) => TResult | Promise<TResult>
) {
  return (ctx: UserContext) => {
    if (!ctx.user) {
      return apiError(BE_ERRORS.AUTH_NO_SESSION);
    }

    return handler(ctx as unknown as AuthenticatedHandlerContext<TBody, TParams, TQuery>);
  };
}

/**
 * Require an authenticated user with a specific permission.
 * Returns 401 if not authenticated, 403 if permission missing.
 *
 * @param permission - Single permission or array (any match required)
 * @param handler - The route handler
 */
export function requirePermission<TBody, TParams, TQuery, TResult>(
  permission: Permission | Permission[],
  handler: (ctx: AuthenticatedHandlerContext<TBody, TParams, TQuery>) => TResult | Promise<TResult>
) {
  const required = Array.isArray(permission) ? permission : [permission];

  return (ctx: UserContext) => {
    if (!ctx.user) {
      return apiError(BE_ERRORS.AUTH_NO_SESSION);
    }

    const userPermissions = ctx.user.permissions || [];
    const hasAccess = required.length === 1
      ? hasPermission(userPermissions, required[0])
      : hasAnyPermission(userPermissions, required);

    if (!hasAccess) {
      return apiError(BE_ERRORS.PERMISSION_DENIED);
    }

    return handler(ctx as unknown as AuthenticatedHandlerContext<TBody, TParams, TQuery>);
  };
}
