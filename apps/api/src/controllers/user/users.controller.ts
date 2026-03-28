/**
 * Users Controller
 *
 * Thin controller that delegates to UserService via DI.
 * Handles HTTP concerns only.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { sessionAuthPlugin, accessControlPlugin, servicesPlugin } from '@plugins';
import { permissionPlugin } from '@plugins/guards';
import { PERMISSIONS } from '@repo/permissions';
import { getClientIP } from '@utils';
import { configs } from '../../configs';
import {
  UpdateProfileSchema,
  PaginationQuerySchema
} from '@repo/schemas';


export const UsersController = new Elysia({ prefix: '/users' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
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
    async ({ user, body, set, request, server, userService, activityService }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const result = await userService.updateProfile(user.id, {
        name: body.name,
        email: body.email,
        phoneNumber: body.phoneNumber,
        emailNotificationsEnabled: body.emailNotificationsEnabled,
        pushNotificationsEnabled: body.pushNotificationsEnabled
      });

      if (!result.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      await activityService.log({
        userId: user.id,
        action: 'update',
        resource: 'user',
        resourceId: user.id,
        changes: { after: body },
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return successResponse({ user: result.user, message: result.message });
    },
    {
      body: UpdateProfileSchema,
      checkPermission: PERMISSIONS.USER_UPDATE_PROFILE
    }
  )

  // List all users (admin) with pagination
  .get(
    '/',
    async ({ query, userService }) => {
      const limit = query.limit ? Math.min(parseInt(query.limit), configs.PAGINATION.MAX_LIMIT) : configs.PAGINATION.DEFAULT_LIMIT;
      const offset = query.offset ? parseInt(query.offset) : 0;
      const result = await userService.getAllUsers({ limit, offset });
      return successResponse({
        users: result.data,
        pagination: result.pagination
      });
    },
    {
      checkPermission: PERMISSIONS.ADMIN_MANAGE_USERS,
      query: PaginationQuerySchema
    }
  )

  // Get user by ID
  .get(
    '/:id',
    async ({ params: { id }, set, userService }) => {
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
    async ({ user, params: { id }, set, request, server, userService, activityService }) => {
      const result = await userService.toggleUserStatus(id);

      if (!result.success) {
        set.status = 404;
        return errorResponse(BE_ERRORS.USER_NOT_FOUND);
      }

      await activityService.log({
        userId: user!.id,
        action: 'status_change',
        resource: 'user',
        resourceId: id,
        metadata: { targetUserId: id, newStatus: result.user?.isActive ? 'active' : 'inactive' },
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return successResponse({ user: result.user, message: result.message });
    },
    {
      params: t.Object({ id: t.String() }),
      checkPermission: PERMISSIONS.ADMIN_MANAGE_USERS
    }
  );
