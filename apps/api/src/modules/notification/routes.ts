/**
 * Notification Routes
 * @logicType http
 */

import { Elysia } from 'elysia';
import * as v from 'valibot';
import { ListNotificationsQuerySchema, MarkAsReadSchema } from './schema';
import { notification } from './handlers/notification.handler';
import { requireUser } from '@/commons/http/require-user';

export const notificationRoutes = new Elysia({ prefix: '/notifications' })
  .get('/', requireUser(notification.list), {
    query: ListNotificationsQuerySchema,
    detail: { tags: ['notifications'], description: 'List user notifications' }
  })
  .get('/unread-count', requireUser(notification.unreadCount), {
    detail: { tags: ['notifications'], description: 'Get unread notification count' }
  })
  .get('/:id', requireUser(notification.get), {
    params: v.object({ id: v.string() }),
    detail: { tags: ['notifications'], description: 'Get notification by ID' }
  })
  .post('/mark-read', requireUser(notification.markAsRead), {
    body: MarkAsReadSchema,
    detail: { tags: ['notifications'], description: 'Mark notifications as read' }
  })
  .post('/mark-all-read', requireUser(notification.markAllAsRead), {
    detail: { tags: ['notifications'], description: 'Mark all notifications as read' }
  })
  .delete('/:id', requireUser(notification.remove), {
    params: v.object({ id: v.string() }),
    detail: { tags: ['notifications'], description: 'Delete notification' }
  });
