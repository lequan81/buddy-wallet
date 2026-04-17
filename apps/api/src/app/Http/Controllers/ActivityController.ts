/**
 * Activity Logs Controller
 *
 * Provides endpoints for viewing user activity logs.
 */
import { Elysia, t } from 'elysia';
import { apiSuccess } from '@repo/errors';
import { servicesPlugin, sessionAuthPlugin } from '@/lib/plugins';
import { ErrorResponseSchema, ActivityListResponseSchema, RecentActivityResponseSchema } from '@repo/schema';
import { requireAuth, parseOffsetPagination } from '@/lib/http';
import type { ActivityLog } from '@repo/db';

/** Maps an ActivityLog entity to the API DTO */
function toActivityDto(log: ActivityLog) {
  return {
    id: log.id,
    userId: log.userId,
    action: log.action,
    target: log.resource,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString()
  };
}

export const ActivityController = new Elysia({ prefix: '/activity' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)

  // Get current user's activity logs
  .get(
    '/',
    async ({ user, query, set, activityService }) => {
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }
      const { limit, offset } = parseOffsetPagination(query);

      const result = await activityService.getLogsForUser(auth.user.id, { limit, offset });

      return apiSuccess({
        ...result,
        data: result.data.map(toActivityDto)
      });
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String())
      }),
      response: {
        200: ActivityListResponseSchema,
        401: ErrorResponseSchema
      }
    }
  )

  // Get recent activity summary
  .get('/recent', async ({ user, set, activityService }) => {
    const auth = requireAuth(user, set);
    if ('error' in auth) {
      return auth.error;
    }
    const logs = await activityService.getRecentActivity(auth.user.id, 10);

    return apiSuccess({ data: logs.map(toActivityDto) });
  }, {
    response: {
      200: RecentActivityResponseSchema,
      401: ErrorResponseSchema
    }
  });
