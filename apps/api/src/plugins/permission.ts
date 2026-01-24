import { Elysia, type Context } from 'elysia';
import { jwtPlugin } from './jwt';
import type { Permission } from '@repo/permissions';

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
          // Dùng error helper của Elysia hoặc trả về Response chuẩn
          // return new Response('Unauthorized Access', { status: 403 });
          set.status = 403;
          return {
            success: false,
            message: 'Unauthorized Access'
          };
        }
      });
    }
  }));
