/**
 * Notification Handlers
 * @logicType http
 */

import { db } from '@/providers/database';
import { NotificationRepository } from '@/repositories/system/notification.repo';
import { BE_ERRORS } from '@repo/errors';
import { calculatePagination } from '@/commons/http/pagination';
import { canAccessNotification, formatNotification } from '../services/notification.service';
import { apiSuccess, apiError } from '@/commons/http/response';
import type {
  GetNotificationContext,
  ListNotificationsContext,
  MarkAllAsReadContext,
  MarkAsReadContext,
  RemoveNotificationContext,
  UnreadCountContext
} from '../types/handler.types';

const notificationRepo = new NotificationRepository(db);

export const notification = {
  /** GET /notifications */
  list: async ({ query, user }: ListNotificationsContext) => {
    const { unreadOnly = false, page = 1, limit = 20 } = query;
    const result = await notificationRepo.findByUserId(user.id, { unreadOnly, page, limit });

    const notifications = result.data.map((n) => formatNotification(n));
    const meta = { ...calculatePagination(result.total, page, limit), unreadCount: result.unreadCount || 0 };

    return apiSuccess(notifications, undefined, meta as unknown as Record<string, unknown>);
  },

  /** GET /notifications/:id */
  get: async ({ params, user }: GetNotificationContext) => {
    const n = await notificationRepo.findById(params.id);
    if (!n) {
      return apiError(BE_ERRORS.NOTIFICATION_NOT_FOUND);
    }
    if (!canAccessNotification(user.id, n.userId)) {
      return apiError(BE_ERRORS.PERMISSION_DENIED);
    }

    return apiSuccess(formatNotification(n));
  },

  /** POST /notifications/mark-read */
  markAsRead: async ({ body, user }: MarkAsReadContext) => {
    const { notificationIds } = body;

    const notifications = await notificationRepo.findByIds(notificationIds);
    if (notifications.length !== notificationIds.length) {
      return apiError(BE_ERRORS.NOTIFICATION_NOT_FOUND);
    }

    for (const n of notifications) {
      if (!canAccessNotification(user.id, n.userId)) {
        return apiError(BE_ERRORS.PERMISSION_DENIED);
      }
    }

    await notificationRepo.markAsRead(notificationIds);
    return apiSuccess({ marked: notificationIds.length }, 'Notifications marked as read');
  },

  /** POST /notifications/mark-all-read */
  markAllAsRead: async ({ user }: MarkAllAsReadContext) => {
    await notificationRepo.markAllAsRead(user.id);
    return apiSuccess({ markedAll: true }, 'All notifications marked as read');
  },

  /** DELETE /notifications/:id */
  remove: async ({ params, user }: RemoveNotificationContext) => {
    const n = await notificationRepo.findById(params.id);
    if (!n) {
      return apiError(BE_ERRORS.NOTIFICATION_NOT_FOUND);
    }
    if (!canAccessNotification(user.id, n.userId)) {
      return apiError(BE_ERRORS.PERMISSION_DENIED);
    }

    await notificationRepo.delete(params.id);
    return apiSuccess({ deleted: true }, 'Notification deleted');
  },

  /** GET /notifications/unread-count */
  unreadCount: async ({ user }: UnreadCountContext) => {
    const count = await notificationRepo.getUnreadCount(user.id);
    return apiSuccess({ unreadCount: count });
  }
};
