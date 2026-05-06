/**
 * Permission Guard Plugin
 *
 * Elysia plugin that provides permission checking functionality.
 * Caches user permissions in Redis for performance.
 *
 * IMPORTANT: Must be used AFTER sessionAuth plugin since it depends on `user` context.
 */
import { Elysia } from 'elysia';
import { sessionAuth } from '@/plugins/auth';
import { permissionCache, isRedisAvailable } from '@/providers/redis';
import type { Permission } from '@/commons/security/permissions';
import { logger } from '@repo/logger';
import { BE_ERRORS } from '@repo/errors';

export const permissionPlugin = new Elysia({ name: 'Permission_Plugin' })
  .use(sessionAuth)
  .derive({ as: 'global' }, async ({ user }): Promise<{ permissions: Permission[] }> => {
    // If no user, no permissions
    if (!user) {
      return { permissions: [] as Permission[] };
    }

    // Try cache first
    if (isRedisAvailable()) {
      const cached = await permissionCache.get(user.id);
      if (cached && Array.isArray(cached)) {
        return { permissions: cached as Permission[] };
      }
    }

    // Get permissions from user object
    const permissions = (user?.permissions as Permission[]) || [];

    // Cache the permissions
    if (isRedisAvailable() && permissions.length > 0) {
      await permissionCache.set(user.id, permissions);
    }

    return { permissions };
  })
  .macro(({ onBeforeHandle }) => ({
    checkPermission(required: Permission) {
      onBeforeHandle(({ permissions, set }: { permissions: Permission[]; set: { status: number } }) => {
        if (!permissions.includes(required)) {
          logger.permission(`Denied: Missing '${required}'`);
          set.status = 403;
          return BE_ERRORS.PERMISSION_DENIED;
        }
      });
    }
  }));

export async function invalidateUserPermissions(userId: string) {
  if (isRedisAvailable()) {
    await permissionCache.del(userId);
  }
}
