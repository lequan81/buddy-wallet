/**
 * Activity Logs Controller
 *
 * Provides endpoints for viewing user activity logs.
 */
import { Elysia, t } from 'elysia';
import { successResponse } from '@repo/errors';
import { servicesPlugin, sessionAuthPlugin } from '@plugins';
import { ErrorResponseSchema, ActivityListResponseSchema, RecentActivityResponseSchema } from '@repo/schemas';
import { requireAuth } from '@/core/http/require-auth';
import { parseOffsetPagination } from '@/core/http/pagination';

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
      
      // Map DB fields to ActivitySchema fields (strict matching)
      const dataWithTarget = result.data.map(log => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        target: log.resource,
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString()
      }));

      return {
        ...result,
        data: dataWithTarget
      };
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
    
    // Map DB fields to ActivitySchema fields (strict matching)
    const logsWithTarget = logs.map(log => ({
      id: log.id,
      userId: log.userId,
      action: log.action,
      target: log.resource,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString()
    }));

    return successResponse({ data: logsWithTarget });
  }, {
    response: {
      200: RecentActivityResponseSchema,
      401: ErrorResponseSchema
    }
  });
