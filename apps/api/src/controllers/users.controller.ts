/**
 * Users Controller
 *
 * Thin controller that delegates to UserService.
 * Handles HTTP concerns only.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { accessControlPlugin } from '@plugins';
import { permissionPlugin } from '@plugins/guards';
import { PERMISSIONS } from '@repo/permissions';
import { userService } from '@/services';

export const usersController = new Elysia({ prefix: '/users' })
  .use(accessControlPlugin)
  .use(permissionPlugin)

  // Get current user profile
  .get('/me', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    return successResponse({ user });
  })

  // Update current user profile
  .patch(
    '/me',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const result = await userService.updateProfile(user.id, {
        name: body.name,
        email: body.email,
        phoneNumber: body.phoneNumber
      });

      if (!result.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return successResponse({ user: result.user, message: result.message });
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        email: t.Optional(t.String({ format: 'email' })),
        phoneNumber: t.Optional(t.String({ pattern: '^\\+?[1-9]\\d{1,14}$' }))
      }),
      checkPermission: PERMISSIONS.USER_UPDATE_PROFILE
    }
  )

  // List all users (admin)
  .get(
    '/',
    async () => {
      const users = await userService.getAllUsers();
      return successResponse({ users });
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
        return errorResponse(BE_ERRORS.USER_NOT_FOUND);
      }

      return successResponse({ user: result.user });
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
        return errorResponse(BE_ERRORS.USER_NOT_FOUND);
      }

      return successResponse({ user: result.user, message: result.message });
    },
    {
      params: t.Object({ id: t.String() }),
      checkPermission: PERMISSIONS.ADMIN_MANAGE_USERS
    }
  );
