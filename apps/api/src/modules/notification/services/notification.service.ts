/**
 * Notification Service - Pure Functions
 * @logicType backend
 */

export function canAccessNotification(userId: string, targetUserId: string): boolean {
  return userId === targetUserId;
}

export function formatNotification(notification: {
  id: string;
  type: string;
  title: string;
  message: string;
  data: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: notification.data ? JSON.parse(notification.data) : null,
    isRead: notification.isRead,
    readAt: notification.readAt,
    createdAt: notification.createdAt
  };
}
