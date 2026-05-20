import type { AuthenticatedHandlerContext } from '@repo/types/api/handler-context';
import type { EntityIdParams } from '@repo/types/api/common-params';
import type { ListQuery } from '@repo/types/api/common-queries';

export type NotificationIdParams = EntityIdParams;

export type ListNotificationsQuery = ListQuery & {
  unreadOnly?: boolean;
};

export interface MarkAsReadBody {
  notificationIds: string[];
}

export type ListNotificationsContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ListNotificationsQuery>;
export type GetNotificationContext = AuthenticatedHandlerContext<unknown, NotificationIdParams>;
export type MarkAsReadContext = AuthenticatedHandlerContext<MarkAsReadBody>;
export type MarkAllAsReadContext = AuthenticatedHandlerContext;
export type RemoveNotificationContext = AuthenticatedHandlerContext<unknown, NotificationIdParams>;
export type UnreadCountContext = AuthenticatedHandlerContext;

