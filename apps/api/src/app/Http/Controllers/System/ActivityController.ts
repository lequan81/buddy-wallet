import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { actor, permissionPlugin } from '@/app/Providers/Plugins';
import { AuthenticatedElysiaContext } from '@/types/elysia';
import { ErrorResponseSchema, ActivityListResponseSchema, RecentActivityResponseSchema } from '@repo/schema';
import { parseOffsetPagination, apiSuccess } from '@/lib/http';
import { GetLogsForUserAction } from '@/app/Actions/System/GetLogsForUserAction';
import { GetRecentActivityAction } from '@/app/Actions/System/GetRecentActivityAction';
import { toActivityResponse } from '@/app/Http/Mappers/ActivityMapper';

/**
 * ActivityController - HTTP API endpoints for activity logging
 */
@injectable()
export class ActivityController {
  constructor(
    @inject(GetLogsForUserAction) private getLogsForUserAction: GetLogsForUserAction,
    @inject(GetRecentActivityAction) private getRecentActivityAction: GetRecentActivityAction
  ) {}

  register(app: Elysia): any {
    return app.group('/activity', (group: any) =>
      group
        .use(actor)
        .use(permissionPlugin)
        .requireActor(true)

        // Get current user's activity logs
        .get(
          '/',
          async (ctx: any) => {
            const { actor, query } = ctx as AuthenticatedElysiaContext<any>;
            const { limit, offset } = parseOffsetPagination(query);

            const result = await this.getLogsForUserAction.execute(actor!.id, { limit, offset });

            return apiSuccess({
              items: result.items.map(toActivityResponse),
              pagination: result.pagination
            });
          },
          {
            query: t.Object({
              limit: t.Optional(t.String()),
              offset: t.Optional(t.String())
            }),
            Response: {
              200: ActivityListResponseSchema,
              401: ErrorResponseSchema
            }
          }
        )

        // Get recent activity summary
        .get(
          '/recent',
          async (ctx: any) => {
            const { actor } = ctx as AuthenticatedElysiaContext;
            const logs = await this.getRecentActivityAction.execute(actor!.id, 10);
 
            return apiSuccess(logs.map(toActivityResponse));
          },
          {
            Response: {
              200: RecentActivityResponseSchema,
              401: ErrorResponseSchema
            }
          }
        )
    );
  }
}
