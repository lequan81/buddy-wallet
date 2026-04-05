import { Elysia, type Context } from 'elysia';
import { sessionAuthPlugin } from '../auth/session-auth.plugin';
import { permissionCache, isRedisAvailable } from '../redis';
import type { Permission } from '@repo/permissions';
import { logger } from '@repo/logger';
import { GEN_ERRORS, apiResponse } from '@repo/errors';

export const permissionPlugin = new Elysia()
  .use(sessionAuthPlugin)
  .derive({ as: 'global' }, async ({ user }): Promise<{ permissions: Permission[] }> => {
    // If no user, no permissions
    if (!user) {
      return { permissions: [] as Permission[] };
    }

    // Try cache first
    if (isRedisAvailable()) {
      const cached = await permissionCache.get(user.id);
      if (cached) {
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
      onBeforeHandle(({ permissions, set }: { permissions: Permission[]; set: Context['set'] }) => {
        if (!permissions.includes(required)) {
          logger.permission(`Denied: Missing '${required}'`);
          set.status = 403;
          return apiResponse({
            ok: false,
            error: GEN_ERRORS.FORBIDDEN,
            details: 'Missing required permission'
          });
        }
      });
    }
  }));

export async function invalidateUserPermissions(userId: string) {
  if (isRedisAvailable()) {
    await permissionCache.del(userId);
  }
}
