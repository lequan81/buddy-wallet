/**
 * Notification Module Schema Definitions
 * 
 * Valibot definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import * as v from 'valibot';

// List notifications query schema
export const ListNotificationsQuerySchema = v.object({
  unreadOnly: v.optional(v.boolean()),
  page: v.optional(v.pipe(v.number(), v.minValue(1))),
  limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100)))
});

// Mark notification as read schema
export const MarkAsReadSchema = v.object({
  notificationIds: v.array(v.string())
});

// Response schemas
export const NotificationResponseSchema = v.object({
  id: v.string(),
  userId: v.string(),
  type: v.string(),
  title: v.string(),
  message: v.string(),
  data: v.optional(v.unknown()),
  isRead: v.boolean(),
  createdAt: v.date(),
  readAt: v.optional(v.date())
});

export const NotificationListResponseSchema = v.object({
  data: v.array(NotificationResponseSchema),
  meta: v.object({
    total: v.number(),
    unreadCount: v.number(),
    page: v.number(),
    limit: v.number(),
    totalPages: v.number()
  })
});
