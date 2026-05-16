/**
 * Activity Handler
 * @logicType http
 *
 * Fetches user activity logs with pagination.
 */

import { ActivityRepository } from '@/repositories/system/activity.repo';
import { apiSuccess } from '@/commons/http/response';
import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { PaginationQuery } from '@/types/common-queries';

const activityRepo = new ActivityRepository();

export const activity = {
  /** GET /activity — List current user's activity logs */
  getLogs: async ({
    query,
    user
  }: AuthenticatedHandlerContext<unknown, Record<string, string>, PaginationQuery>) => {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const result = await activityRepo.findManyByUserId(user.id, { limit, offset });

    return apiSuccess(result.items, undefined, {
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit
    });
  }
};
