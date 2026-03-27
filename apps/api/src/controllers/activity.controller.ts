/**
 * Activity Logs Controller
 *
 * Provides endpoints for viewing user activity logs.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { sessionAuthPlugin, servicesPlugin } from '@plugins';
import { permissionPlugin } from '@plugins/guards';

export const ActivityController = new Elysia({ prefix: '/activity' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(permissionPlugin)

  // Get current user's activity logs
  .get(
    '/',
    async ({ user, query, set, activityService }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const limit = query.limit ? Math.min(parseInt(query.limit), 100) : 50;
      const offset = query.offset ? parseInt(query.offset) : 0;

      const result = await activityService.getLogsForUser(user!.id, { limit, offset });
      return successResponse({
        logs: result.logs,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: result.hasMore
        }
      });
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String())
      })
    }
  )

  // Get recent activity summary
  .get('/recent', async ({ user, set, activityService }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }
    const logs = await activityService.getRecentActivity(user.id, 10);
    return successResponse({ logs });
  });
