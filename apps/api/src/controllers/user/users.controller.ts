/**
 * Users Controller
 *
 * Thin controller that delegates to UserService via DI.
 * Handles HTTP concerns only.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, apiResponse } from '@repo/errors';
import { accessControlPlugin, permissionPlugin, servicesPlugin, sessionAuthPlugin } from '@plugins';
import { PERMISSIONS } from '@repo/permissions';
import { getClientIP, toSafeUser } from '@utils';
import {
  UpdateProfileSchema,
  PaginationQuerySchema
} from '@repo/schemas';
import { parseOffsetPagination } from '@/core/http/pagination';
import { isFailureResult } from '@/core/http/result-helper';
import { resolveActor } from '@/core/http/response.helpers';

export const UsersController = new Elysia({ prefix: '/users' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(permissionPlugin)
  .use(accessControlPlugin)

  // Get current user profile
  .get('/me', async ({ user, set }) => {
    const resolved = await resolveActor(user, set);
    if (!resolved.ok) return resolved.error;

    return apiResponse({ 
      ok: true, 
      data: { user: toSafeUser(resolved.user) } 
    });
  })

  // Update current user profile
  .patch(
    '/me',
    async ({ user, body, set, request, server, userService, activityService }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

      const result = await userService.updateProfile(freshUser.id, {
        name: body.name,
        email: body.email,
        phoneNumber: body.phoneNumber,
        emailNotificationsEnabled: body.emailNotificationsEnabled,
        pushNotificationsEnabled: body.pushNotificationsEnabled
      });

      if (isFailureResult(result)) {
        set.status = 400;
        return apiResponse({ ok: false, error: GEN_ERRORS.INVALID_INPUT, details: result.error });
      }

      await activityService.log({
        userId: freshUser.id,
        action: 'update',
        resource: 'user',
        resourceId: freshUser.id,
        changes: { after: body },
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return apiResponse({ 
        ok: true, 
        data: { 
          user: toSafeUser(result.user), 
          message: result.message 
        } 
      });
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
      return apiResponse({ ok: true, data: result });
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

      if (isFailureResult(result)) {
        set.status = 404;
        return apiResponse({ ok: false, error: BE_ERRORS.USER_NOT_FOUND });
      }

      return apiResponse({ 
        ok: true, 
        data: { user: toSafeUser(result.user) } 
      });
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
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;

      const result = await userService.toggleUserStatus(id);

      if (isFailureResult(result)) {
        set.status = 404;
        return apiResponse({ ok: false, error: BE_ERRORS.USER_NOT_FOUND });
      }

      await activityService.log({
        userId: resolved.user.id,
        action: 'status_change',
        resource: 'user',
        resourceId: id,
        metadata: { targetUserId: id, newStatus: result.user?.isActive ? 'active' : 'inactive' },
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return apiResponse({ 
        ok: true, 
        data: { 
          user: toSafeUser(result.user), 
          message: result.message 
        } 
      });
    },
    {
      params: t.Object({ id: t.String() }),
      checkPermission: PERMISSIONS.ADMIN_MANAGE_USERS
    }
  );
