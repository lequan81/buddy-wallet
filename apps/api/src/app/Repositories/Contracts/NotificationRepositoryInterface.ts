import type { PushSubscription } from '@repo/db';

export interface NotificationRepositoryInterface {
  upsertSubscription(userId: string, input: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
    deviceName?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
  }): Promise<string>;
  deleteSubscription(userId: string, endpoint: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  getSubscriptionsByUserId(userId: string, onlyActive?: boolean): Promise<PushSubscription[]>;
  getAllActiveSubscriptions(): Promise<PushSubscription[]>;
  updateSubscriptionStatus(id: string, data: {
    isActive?: boolean;
    failedAttempts?: number;
    lastUsedAt?: Date;
  }): Promise<void>;
  cleanupInactive(daysOld: number): Promise<number>;
}

