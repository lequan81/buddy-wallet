import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { apiSuccess, apiError, GEN_ERRORS, BE_ERRORS } from '@repo/errors';
import { accessControlPlugin, permissionPlugin, sessionAuthPlugin, containerPlugin } from '@plugins';
import { PERMISSIONS } from '@repo/permissions';
import { toSafeUser } from '@lib/security/password';
import { getClientIP } from '@lib/http/ip';
import {
  UpdateProfileSchema,
  PaginationQuerySchema
} from '@repo/schema';
import { parseOffsetPagination } from '@/core/http/pagination';
import { isFailureResult } from '@/core/http/result-helper';
import { resolveActor } from '@/core/http/response.helpers';
import { UserService } from '@/app/Services/UserService';
import { ActivityService } from '@/app/Services/ActivityService';

@injectable()
export class UserController {
  constructor(
    @inject(UserService) private userService: UserService,
    @inject(ActivityService) private activityService: ActivityService
  ) {}

  register(app: Elysia): Elysia {
    return app.group('/users', (group) =>
      group
        .use(containerPlugin)
        .use(sessionAuthPlugin)
        .use(permissionPlugin)
        .use(accessControlPlugin)

        // Get current user profile
        .get('/me', async ({ user, set }) => {
          const resolved = await resolveActor(user, set);
          if (!resolved.ok) return resolved.error;

          return apiSuccess({ user: toSafeUser(resolved.user) });
        })

        // Update current user profile
        .patch(
          '/me',
          async ({ user, body, set, request, server }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { user: freshUser } = resolved;

            const result = await this.userService.updateProfile(freshUser.id, {
              name: body.name,
              email: body.email,
              phoneNumber: body.phoneNumber,
              emailNotificationsEnabled: body.emailNotificationsEnabled,
              pushNotificationsEnabled: body.pushNotificationsEnabled
            });

            if (isFailureResult(result)) {
              set.status = 400;
              return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
            }

            await this.activityService.log({
              userId: freshUser.id,
              action: 'update',
              resource: 'user',
              resourceId: freshUser.id,
              changes: { after: body },
              ipAddress: getClientIP(request, server) || undefined,
              userAgent: request.headers.get('user-agent') || undefined
            });

            return apiSuccess({ 
              user: result.data.user, 
              message: result.data.message 
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
          async ({ query }) => {
            const { limit, offset } = parseOffsetPagination(query);
            const result = await this.userService.getAllUsers({ limit, offset });
            return apiSuccess(result);
          },
          {
            checkPermission: PERMISSIONS.ADMIN_MANAGE_USERS,
            query: PaginationQuerySchema
          }
        )

        // Get user by ID
        .get(
          '/:id',
          async ({ params: { id }, set }) => {
            const result = await this.userService.getUserById(id);

            if (isFailureResult(result)) {
              set.status = 404;
              return apiError(BE_ERRORS.USER_NOT_FOUND);
            }

            return apiSuccess({ user: result.data.user });
          },
          {
            params: t.Object({ id: t.String() })
          }
        )

        // Toggle user status (admin)
        .patch(
          '/:id/status',
          async ({ user, params: { id }, set, request, server }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;

            const result = await this.userService.toggleUserStatus(id);

            if (isFailureResult(result)) {
              set.status = 404;
              return apiError(BE_ERRORS.USER_NOT_FOUND);
            }

            await this.activityService.log({
              userId: resolved.user.id,
              action: 'status_change',
              resource: 'user',
              resourceId: id,
              metadata: { targetUserId: id, newStatus: result.data.user?.isActive ? 'active' : 'inactive' },
              ipAddress: getClientIP(request, server) || undefined,
              userAgent: request.headers.get('user-agent') || undefined
            });

            return apiSuccess({ 
              user: result.data.user, 
              message: result.data.message 
            });
          },
          {
            params: t.Object({ id: t.String() }),
            checkPermission: PERMISSIONS.ADMIN_MANAGE_USERS
          }
        )
    );
  }
}
