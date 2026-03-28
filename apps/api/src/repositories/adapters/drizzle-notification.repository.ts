import { pushSubscriptions, eq, and, lte } from '@repo/db';
import type { DbClient } from '@/types';
import type { INotificationRepository } from '@repo/types';
import type { PushSubscription } from '@repo/db';
import { randomUUIDv7 } from 'bun';

export class DrizzleNotificationRepository implements INotificationRepository {
  constructor(private db: DbClient) {}

  async upsertSubscription(userId: string, input: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
    deviceName?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
  }): Promise<string> {
    const existing = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, input.endpoint))
      .get();

    if (existing) {
      await this.db
        .update(pushSubscriptions)
        .set({
          userId,
          p256dhKey: input.keys.p256dh,
          authKey: input.keys.auth,
          expirationTime: input.expirationTime ? new Date(input.expirationTime) : null,
          deviceName: input.deviceName || existing.deviceName,
          deviceType: input.deviceType || existing.deviceType,
          isActive: true,
          failedAttempts: 0,
          updatedAt: new Date()
        })
        .where(eq(pushSubscriptions.id, existing.id));

      return existing.id;
    }

    const id = randomUUIDv7('base64url');
    await this.db.insert(pushSubscriptions).values({
      id,
      userId,
      endpoint: input.endpoint,
      p256dhKey: input.keys.p256dh,
      authKey: input.keys.auth,
      expirationTime: input.expirationTime ? new Date(input.expirationTime) : null,
      deviceName: input.deviceName,
      deviceType: input.deviceType,
      isActive: true,
      failedAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return id;
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
      .run();
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id)).run();
  }

  async getSubscriptionsByUserId(userId: string, onlyActive = true): Promise<PushSubscription[]> {
    const where = onlyActive 
      ? and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true))
      : eq(pushSubscriptions.userId, userId);
      
    return this.db
      .select()
      .from(pushSubscriptions)
      .where(where)
      .all() as PushSubscription[];
  }

  async getAllActiveSubscriptions(): Promise<PushSubscription[]> {
    return this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.isActive, true))
      .all() as PushSubscription[];
  }

  async updateSubscriptionStatus(id: string, data: { isActive?: boolean; failedAttempts?: number; lastUsedAt?: Date }): Promise<void> {
    await this.db
      .update(pushSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pushSubscriptions.id, id))
      .run();
  }

  async cleanupInactive(daysOld: number): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    // First count then delete or just delete and use returning count if supported
    const result = await this.db.delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.isActive, false), lte(pushSubscriptions.updatedAt, cutoff)))
      .returning({ id: pushSubscriptions.id });
      
    return result.length;
  }
}
