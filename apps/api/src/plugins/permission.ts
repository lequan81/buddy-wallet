import { Elysia, type Context } from 'elysia';
import { jwtPlugin } from './jwt';
import type { Permission } from '@repo/permissions';
import { logger } from '../utils/logger';

export const permissionPlugin = new Elysia()
  .use(jwtPlugin)
  .derive(({ user }) => {
    return {
      permissions: (user?.permissions as Permission[]) || []
    };
  })
  .macro(({ onBeforeHandle }) => ({
    checkPermission(required: Permission) {
      onBeforeHandle(({ permissions, set }: { permissions: Permission[]; set: Context['set'] }) => {
        if (!permissions.includes(required)) {
          logger.permission(`Denied: Missing '${required}'`);
          set.status = 403;
          return {
            success: false,
            message: 'Unauthorized Access'
          };
        }
      });
    }
  }));
