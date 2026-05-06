/**
 * Notification Module Schema Definitions
 * 
 * TypeBox definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import { t } from 'elysia';

// List notifications query schema
export const ListNotificationsQuerySchema = t.Object({
  unreadOnly: t.Optional(t.Boolean({ default: false })),
  page: t.Optional(t.Number({
    minimum: 1,
    default: 1
  })),
  limit: t.Optional(t.Number({
    minimum: 1,
    maximum: 100,
    default: 20
  }))
});

// Mark notification as read schema
export const MarkAsReadSchema = t.Object({
  notificationIds: t.Array(t.String())
});

// Response schemas
export const NotificationResponseSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  type: t.String(),
  title: t.String(),
  message: t.String(),
  data: t.Optional(t.Unknown()),
  isRead: t.Boolean(),
  createdAt: t.Date(),
  readAt: t.Optional(t.Date())
});

export const NotificationListResponseSchema = t.Object({
  data: t.Array(NotificationResponseSchema),
  meta: t.Object({
    total: t.Number(),
    unreadCount: t.Number(),
    page: t.Number(),
    limit: t.Number(),
    totalPages: t.Number()
  })
});
