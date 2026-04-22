import { injectable, inject } from 'tsyringe';
import { eq, and, lt, or, desc } from '@repo/db';
import { pushSubscriptions, type PushSubscription, type DbClient } from '@repo/db';
import type { NotificationRepositoryInterface } from '../Contracts/NotificationRepositoryInterface';

@injectable()
export class NotificationRepository implements NotificationRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async upsertSubscription(userId: string, input: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    deviceName?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
  }): Promise<string> {
    const { endpoint, keys, deviceName, deviceType } = input;
    
    // Check if endpoint exists
    const existing: any = await this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).get();
    
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
      await this.db.update(pushSubscriptions).set(data).where(eq(pushSubscriptions.id, existing.id));
      return existing.id;
    } else {
      const id = crypto.randomUUID();
      await this.db.insert(pushSubscriptions).values({
        ...data,
        id,
        createdAt: new Date(),
        failedAttempts: 0
      });
      return id;
    }
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  }

  async getSubscriptionsByUserId(userId: string, onlyActive?: boolean): Promise<PushSubscription[]> {
    const conditions = [eq(pushSubscriptions.userId, userId)];
    if (onlyActive) conditions.push(eq(pushSubscriptions.isActive, true));
    
    const result = await this.db.select().from(pushSubscriptions).where(and(...conditions)).orderBy(desc(pushSubscriptions.lastUsedAt)).all();
    return (result as any[]) as PushSubscription[];
  }

  async getAllActiveSubscriptions(): Promise<PushSubscription[]> {
    const result = await this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.isActive, true)).all();
    return (result as any[]) as PushSubscription[];
  }

  async updateSubscriptionStatus(id: string, data: { isActive?: boolean; failedAttempts?: number; lastUsedAt?: Date }): Promise<void> {
    await this.db.update(pushSubscriptions).set({ ...data, updatedAt: new Date() }).where(eq(pushSubscriptions.id, id));
  }

  async cleanupInactive(daysOld: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    
    const result = await this.db.delete(pushSubscriptions).where(or(eq(pushSubscriptions.isActive, false), lt(pushSubscriptions.lastUsedAt, cutoff))).returning();
    return result.length;
  }
}

