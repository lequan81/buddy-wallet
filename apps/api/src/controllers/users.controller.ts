/**
 * Users Controller
 *
 * Thin controller that delegates to UserService.
 * Handles HTTP concerns only.
 */
import { Elysia, t } from 'elysia';
import { accessControlPlugin } from '@plugins/access-control';
import { permissionPlugin } from '@plugins/permission';
import { PERMISSIONS } from '@repo/permissions';
import { userService } from '@/services';

export const usersController = new Elysia({ prefix: '/users' })
  .use(accessControlPlugin)
  .use(permissionPlugin)

  // List all users (admin)
  .get(
    '/',
    async () => {
      const users = await userService.getAllUsers();
      return { success: true, users };
    },
    { checkPermission: PERMISSIONS.ADMIN_MANAGE_USERS }
  )

  // Get user by ID
  .get(
    '/:id',
    async ({ params: { id }, set }) => {
      const result = await userService.getUserById(id);

      if (!result.success) {
        set.status = 404;
        return result;
      }

      return result;
    },
    {
      params: t.Object({ id: t.String() }),
      ensureRelatedUser: 'id'
    }
  )

  // Toggle user status (admin)
  .patch(
    '/:id/status',
    async ({ params: { id }, set }) => {
      const result = await userService.toggleUserStatus(id);

      if (!result.success) {
        set.status = 404;
        return result;
      }

      return result;
    },
    {
      params: t.Object({ id: t.String() }),
      checkPermission: PERMISSIONS.ADMIN_MANAGE_USERS
    }
  );
