/**
 * Permission Middleware
 *
 * Checks if the authenticated user has the required permission.
 * Used with Elysia route handlers via the `checkPermission` option.
 */

import { Elysia } from 'elysia';
import { hasPermission } from '@/lib/security/permissions';
import type { Permission } from '@repo/types/infrastructure/permissions';
import { BE_ERRORS, apiError } from '@repo/errors';

export interface PermissionCheckOptions {
  /** Required permission to access this route */
  checkPermission?: Permission;
  /** Require admin role (overrides checkPermission) */
  requireAdmin?: boolean;
}

/**
 * Permission middleware for Elysia
 * Checks user permissions before allowing access to routes
 */
export const permissionMiddleware = new Elysia({ name: 'Permission' })
  .onBeforeHandle(async function checkPermissions({ user, set, request, path }) {
    // Skip if no user (auth middleware will handle)
    if (!user) return;

    // Get route metadata for permission requirements
    const route = Reflect.getMetadata('permission:required', request);
    if (!route) return; // No permission check required for this route

    const userPermissions = (user as any).permissions || [];

    // Check if permission is satisfied
    if (!hasPermission(userPermissions, route)) {
      set.status = 403;
      return apiError(BE_ERRORS.UNAUTHORIZED, 'Insufficient permissions');
    }
  });
