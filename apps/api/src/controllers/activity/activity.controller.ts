/**
 * Activity Logs Controller
 *
 * Provides endpoints for viewing user activity logs.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { servicesPlugin, sessionAuthPlugin } from '@plugins';
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
    const auth = requireAuth(user, set);
    if ('error' in auth) {
      return auth.error;
    }
    const logs = await activityService.getRecentActivity(auth.user.id, 10); // 10 is fine for "recent" summary
    return successResponse({ logs });
  });
