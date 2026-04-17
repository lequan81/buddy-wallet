import { injectable, inject } from 'tsyringe';
import { eq, and, isNull, inArray, count, desc, lt, or } from '@repo/db';
import { subscriptions, type PushSubscription, type DbClient } from '@repo/db';
import type { NotificationRepositoryInterface } from '../Contracts/NotificationRepositoryInterface';

@injectable()
export class NotificationRepository implements NotificationRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async upsertSubscription(userId: string, input: any): Promise<string> {
    const { endpoint, keys, deviceName, deviceType } = input;
    
    // Check if endpoint exists
    const existing = await this.db.select().from(subscriptions).where(eq(subscriptions.endpoint, endpoint)).get();
    
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
      await this.db.update(subscriptions).set(data).where(eq(subscriptions.id, existing.id));
      return existing.id;
    } else {
      const id = crypto.randomUUID();
      await this.db.insert(subscriptions).values({
        ...data,
        id,
        createdAt: new Date(),
        failedAttempts: 0
      });
      return id;
    }
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    await this.db.delete(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.endpoint, endpoint)));
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(subscriptions).where(eq(subscriptions.id, id));
  }

  async getSubscriptionsByUserId(userId: string, onlyActive?: boolean): Promise<PushSubscription[]> {
    const conditions = [eq(subscriptions.userId, userId)];
    if (onlyActive) conditions.push(eq(subscriptions.isActive, true));
    
    const result = await this.db.select().from(subscriptions).where(and(...conditions)).orderBy(desc(subscriptions.lastUsedAt)).all();
    return result as PushSubscription[];
  }

  async getAllActiveSubscriptions(): Promise<PushSubscription[]> {
    const result = await this.db.select().from(subscriptions).where(eq(subscriptions.isActive, true)).all();
    return result as PushSubscription[];
  }

  async updateSubscriptionStatus(id: string, data: any): Promise<void> {
    await this.db.update(subscriptions).set({ ...data, updatedAt: new Date() }).where(eq(subscriptions.id, id));
  }

  async cleanupInactive(daysOld: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    
    const result = await this.db.delete(subscriptions).where(or(eq(subscriptions.isActive, false), lt(subscriptions.lastUsedAt, cutoff))).returning();
    return result.length;
  }
}
