/**
 * Activity Routes
 * @logicType http
 */

import { Elysia } from 'elysia';
import * as v from 'valibot';
import { activity } from './handlers/activity.handler';
import { requireUser } from '@/commons/http/require-user';

export const activityRoutes = new Elysia({ prefix: '/activity' }).get(
  '/',
  requireUser(activity.getLogs),
  {
    query: v.object({
      page: v.optional(v.pipe(v.unknown(), v.transform((v) => Number(v)), v.number(), v.minValue(1))),
      limit: v.optional(v.pipe(v.unknown(), v.transform((v) => Number(v)), v.number(), v.minValue(1), v.maxValue(100)))
    }),
    detail: { tags: ['activity'], description: 'List current user activity logs' }
  }
);
