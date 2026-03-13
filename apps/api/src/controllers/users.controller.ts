/**
 * Users Controller
 *
 * Thin controller that delegates to UserService.
 * Handles HTTP concerns only.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { accessControlPlugin } from '../plugins';
import { permissionPlugin } from '../plugins/guards';
import { PERMISSIONS } from '@repo/permissions';
import { UserService, ActivityService } from '../services';
import { getClientIP } from '../utils';

const NullableString = t.Union([t.String(), t.Literal(null)]);
const NullableDateString = t.Union([t.String(), t.Literal(null)]);

const UserSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: NullableString,
  phoneNumber: NullableString,
  role: t.String(),
  permissions: t.Array(t.String()),
  isActive: t.Boolean(),
  emailVerified: t.Optional(t.Boolean()),
  emailNotificationsEnabled: t.Optional(t.Boolean()),
  pushNotificationsEnabled: t.Optional(t.Boolean()),
  mustChangePassword: t.Optional(t.Boolean()),
  createdAt: NullableDateString,
  updatedAt: NullableDateString
});

const PaginationSchema = t.Object({
  total: t.Number(),
  limit: t.Number(),
  offset: t.Number(),
  hasMore: t.Boolean()
});

const UsersListResponseSchema = t.Object({
  success: t.Literal(true),
  users: t.Array(UserSchema),
  pagination: PaginationSchema
});

const UserResponseSchema = t.Object({
  success: t.Literal(true),
  user: UserSchema
});

export const UsersController = new Elysia({ prefix: '/users' })
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
    async ({ user, body, set, request, server }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const result = await UserService.updateProfile(user.id, {
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

      await ActivityService.log({
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
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        email: t.Optional(t.String({ format: 'email' })),
        phoneNumber: t.Optional(t.String({ pattern: '^\\+?[1-9]\\d{1,14}$' })),
        emailNotificationsEnabled: t.Optional(t.Boolean()),
        pushNotificationsEnabled: t.Optional(t.Boolean())
      }),
      checkPermission: PERMISSIONS.USER_UPDATE_PROFILE
    }
  )

  // List all users (admin) with pagination
  .get(
    '/',
    async ({ query }) => {
      const limit = query.limit ? Math.min(parseInt(query.limit), 100) : 50;
      const offset = query.offset ? parseInt(query.offset) : 0;
      const result = await UserService.getAllUsers({ limit, offset });
      return successResponse({
        users: result.users,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: result.hasMore
        }
      });
    },
    {
      checkPermission: PERMISSIONS.ADMIN_MANAGE_USERS,
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String())
      }),
      response: { 200: UsersListResponseSchema }
    }
  )

  // Get user by ID
  .get(
    '/:id',
    async ({ params: { id }, set }) => {
      const result = await UserService.getUserById(id);

      if (!result.success) {
        set.status = 404;
        return errorResponse(BE_ERRORS.USER_NOT_FOUND);
      }

      return successResponse({ user: result.user });
    },
    {
      params: t.Object({ id: t.String() }),
      ensureRelatedUser: 'id',
      response: { 200: UserResponseSchema }
    }
  )

  // Toggle user status (admin)
  .patch(
    '/:id/status',
    async ({ user, params: { id }, set, request, server }) => {
      const result = await UserService.toggleUserStatus(id);

      if (!result.success) {
        set.status = 404;
        return errorResponse(BE_ERRORS.USER_NOT_FOUND);
      }

      await ActivityService.log({
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
