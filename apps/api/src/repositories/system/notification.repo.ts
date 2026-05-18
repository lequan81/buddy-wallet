import { pushSubscriptions, notifications, eq, and, or, lt, inArray, sql, count, desc } from '@repo/db';
import type { DbClient, Notification, PushSubscription } from '@repo/db';
import { db } from '@/providers/database';
import * as v from 'valibot';

// ── Valibot Validation Schemas ────────────────────────────────
const UpdateSubscriptionSchema = v.object({
  isActive: v.optional(v.boolean()),
  failedAttempts: v.optional(v.pipe(v.number(), v.minValue(0))),
  lastUsedAt: v.optional(v.union([v.date(), v.null_()]))
});

import { randomUUIDv7 } from 'bun';

/**
 * Notification Repository
 * Data access layer for notification operations
 * No DI container - uses direct db instance
 */
export class NotificationRepository {
  constructor(private readonly database: DbClient = db) {}

  // ── Push Subscriptions ──────────────────────────────────

  async upsertSubscription(userId: string, input: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    deviceName?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
  }): Promise<string> {
    const { endpoint, keys, deviceName, deviceType } = input;
    
    // Check if endpoint exists
    const existing = await this.database.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).get() as { id: string } | null;

    const data = {
      userId,
      endpoint,
      p256dhKey: keys.p256dh,
      authKey: keys.auth,
      deviceName: deviceName || 'Unknown Device',
      deviceType: deviceType || 'unknown',
      isActive: true,
      lastUsedAt: new Date(),
      updatedAt: new Date()
    };

    if (existing) {
      await this.database.update(pushSubscriptions).set(data).where(eq(pushSubscriptions.id, existing.id));
      return existing.id;
    } else {
      const id = randomUUIDv7();
      await this.database.insert(pushSubscriptions).values({
        ...data,
        id,
        createdAt: new Date(),
        failedAttempts: 0
      });
      return id;
    }
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    await this.database.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  }

  async deleteSubscriptionById(id: string): Promise<void> {
    await this.database.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  }

  async getSubscriptionsByUserId(userId: string, onlyActive?: boolean): Promise<PushSubscription[]> {
    const conditions = [eq(pushSubscriptions.userId, userId)];
    if (onlyActive) conditions.push(eq(pushSubscriptions.isActive, true));
    
    const result = await this.database
      .select()
      .from(pushSubscriptions)
      .where(and(...conditions))
      .orderBy(desc(pushSubscriptions.lastUsedAt))
      .all();
    return result as unknown as PushSubscription[];
  }

  async getAllActiveSubscriptions(): Promise<PushSubscription[]> {
    const result = await this.database.select().from(pushSubscriptions).where(eq(pushSubscriptions.isActive, true)).all();
    return (result as unknown[]) as PushSubscription[];
  }

  async updateSubscriptionStatus(id: string, data: { isActive?: boolean; failedAttempts?: number; lastUsedAt?: Date }): Promise<void> {
    await this.database.update(pushSubscriptions).set({ ...data, updatedAt: new Date() }).where(eq(pushSubscriptions.id, id));
  }

  async cleanupInactiveSubscriptions(daysOld: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    
    const result = await this.database.delete(pushSubscriptions).where(or(eq(pushSubscriptions.isActive, false), lt(pushSubscriptions.lastUsedAt, cutoff))).returning();
    return result.length;
  }

  // ── In-App Notifications ────────────────────────────────

  async create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<Notification> {
    const [created] = await this.database.insert(notifications).values({
      id: randomUUIDv7(),
      ...data,
      data: data.data ? JSON.stringify(data.data) : null,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return created as Notification;
  }

  async findByUserId(userId: string, options: { unreadOnly?: boolean; page?: number; limit?: number }): Promise<{ data: Notification[]; total: number; unreadCount: number }> {
    const { unreadOnly = false, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(notifications.userId, userId)];
    if (unreadOnly) conditions.push(eq(notifications.isRead, false));

    const [data, countResult, unreadCountResult] = await Promise.all([
      this.database.select()
        .from(notifications)
        .where(and(...conditions))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(notifications.createdAt))
        .all(),
      this.database.select({ count: count() })
        .from(notifications)
        .where(and(...conditions))
        .get(),
      this.database.select({ count: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
        .get()
    ]);

    return {
      data: data as Notification[],
      total: Number(countResult?.count ?? 0),
      unreadCount: Number(unreadCountResult?.count ?? 0)
    };
  }

  async findById(id: string): Promise<Notification | null> {
    const result = await this.database.select().from(notifications).where(eq(notifications.id, id)).get();
    return (result as Notification) || null;
  }

  async findByIds(ids: string[]): Promise<Notification[]> {
    if (ids.length === 0) return [];
    const result = await this.database.select().from(notifications).where(inArray(notifications.id, ids)).all();
    return result as Notification[];
  }

  async markAsRead(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;
    await this.database.update(notifications)
      .set({ isRead: true, readAt: new Date(), updatedAt: new Date() })
      .where(inArray(notifications.id, notificationIds));
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.database.update(notifications)
      .set({ isRead: true, readAt: new Date(), updatedAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.database.select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .get();
    return Number(result?.count ?? 0);
  }

  async delete(id: string): Promise<void> {
    await this.database.delete(notifications).where(eq(notifications.id, id));
  }
}

