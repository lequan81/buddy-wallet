import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS } from '@repo/errors';
import { actor, permissionPlugin, accessControl, redisPlugin } from '@/app/Providers/Plugins';
import { AuthenticatedElysiaContext } from '@/types/elysia';
import { PERMISSIONS } from '@/lib/security/permissions';
import { getClientIP } from '@/lib/http/ip';
import {
  UpdateProfileSchema,
  PaginationQuerySchema
} from '@repo/schema';
import { apiSuccess, apiError, isFailureResult, parseOffsetPagination } from '@/lib/http';
import { GetAllUsersAction } from '@/app/Actions/User/GetAllUsersAction';
import { GetUserByIdAction } from '@/app/Actions/User/GetUserByIdAction';
import { ToggleUserStatusAction } from '@/app/Actions/User/ToggleUserStatusAction';
import { UpdateProfileAction } from '@/app/Actions/User/UpdateProfileAction';
import { LogAction } from '@/app/Actions/System/LogAction';
import type { SafeUser } from '@repo/types';

/**
 * UserController - HTTP API endpoints for user management
 */
@injectable()
export class UserController {
  constructor(
    @inject(GetAllUsersAction) private getAllUsersAction: GetAllUsersAction,
    @inject(GetUserByIdAction) private getUserByIdAction: GetUserByIdAction,
    @inject(ToggleUserStatusAction) private toggleUserStatusAction: ToggleUserStatusAction,
    @inject(UpdateProfileAction) private updateProfileAction: UpdateProfileAction,
    @inject(LogAction) private logAction: LogAction
  ) {}

  /**
   * Registers all user routes on the Elysia app
   */
  register(app: Elysia): any {
    return app.group('/users', (group: any) =>
      group
        .use(actor)
        .use(redisPlugin)
        .use(permissionPlugin)
        .use(accessControl)
        .requireActor(true)

        // Get current user profile
        .get('/me', async (ctx: any) => {
          const { actor } = ctx as AuthenticatedElysiaContext;
          return apiSuccess({ user: actor });
        })

        // Update current user profile
        .patch(
          '/me',
          async (ctx: any) => {
            const { actor, body, request, server } = ctx as AuthenticatedElysiaContext<any>;
            const result = await this.updateProfileAction.execute(actor!.id, {
              name: body.name,
              email: body.email,
              phoneNumber: body.phoneNumber,
              emailNotificationsEnabled: body.emailNotificationsEnabled,
              pushNotificationsEnabled: body.pushNotificationsEnabled
            });

            if (isFailureResult(result)) {
              return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
            }

            await this.logAction.execute({
              userId: actor!.id,
              action: 'update',
              resource: 'user',
              resourceId: actor!.id,
              changes: { after: body },
              ipAddress: getClientIP(request, server) || undefined,
              userAgent: request.headers.get('user-agent') || undefined
            });

            return apiSuccess({ 
              user: result.data.user as SafeUser, 
              message: result.data.message 
            });
          },
          {
            body: UpdateProfileSchema,
            checkPermission: PERMISSIONS.USER_UPDATE_PROFILE
          }
        )

        // List all users (admin) with Pagination
        .get(
          '/',
          async (ctx: any) => {
            const { query } = ctx as AuthenticatedElysiaContext<any>;
            const { limit, offset } = parseOffsetPagination(query);
            const result = await this.getAllUsersAction.execute({ limit, offset });
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
          async (ctx: any) => {
            const { params: { id }, set } = ctx as AuthenticatedElysiaContext;
            const result = await this.getUserByIdAction.execute(id);
 
            if (isFailureResult(result)) {
              set.status = 404;
              return apiError(BE_ERRORS.USER_NOT_FOUND);
            }
 
            return apiSuccess({ user: result.data.user as SafeUser });
          },
          {
            params: t.Object({ id: t.String() })
          }
        )

        // Toggle user status (admin)
        .patch(
          '/:id/status',
          async (ctx: any) => {
            const { actor, params: { id }, request, server } = ctx as AuthenticatedElysiaContext;
            const result = await this.toggleUserStatusAction.execute(id);
 
            if (isFailureResult(result)) {
              return apiError(BE_ERRORS.USER_NOT_FOUND);
            }
 
            await this.logAction.execute({
              userId: actor!.id,
              action: 'status_change',
              resource: 'user',
              resourceId: id,
              metadata: { targetUserId: id, newStatus: (result.data.user as SafeUser)?.isActive ? 'active' : 'inactive' },
              ipAddress: getClientIP(request, server) || undefined,
              userAgent: request.headers.get('user-agent') || undefined
            });

            return apiSuccess({ 
              user: result.data.user as SafeUser, 
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
