/**
 * Users Controller
 *
 * Thin controller that delegates to UserService via DI.
 * Handles HTTP concerns only.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { accessControlPlugin, permissionPlugin, servicesPlugin, sessionAuthPlugin } from '@plugins';
import { PERMISSIONS } from '@repo/permissions';
import { getClientIP, toSafeUser } from '@utils';
import {
  UpdateProfileSchema,
  PaginationQuerySchema
} from '@repo/schemas';
import { parseOffsetPagination } from '@/core/http/pagination';
import { requireAuth } from '@/core/http/require-auth';


export const UsersController = new Elysia({ prefix: '/users' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(permissionPlugin)
  .use(accessControlPlugin)

  // Get current user profile
  .get('/me', async ({ user, set }) => {
    const auth = requireAuth(user, set);
    if ('error' in auth) {
      return auth.error;
    }

    return successResponse({ user: toSafeUser(auth.user) });
  })

  // Update current user profile
  .patch(
    '/me',
    async ({ user, body, set, request, server, userService, activityService }) => {
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }

      const result = await userService.updateProfile(auth.user.id, {
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
        userId: auth.user.id,
        action: 'update',
        resource: 'user',
        resourceId: auth.user.id,
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
      const { limit, offset } = parseOffsetPagination(query);
      const result = await userService.getAllUsers({ limit, offset });
      return successResponse(result);
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
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }

      const result = await userService.toggleUserStatus(id);

      if (!result.success) {
        set.status = 404;
        return errorResponse(BE_ERRORS.USER_NOT_FOUND);
      }

      await activityService.log({
        userId: auth.user.id,
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
