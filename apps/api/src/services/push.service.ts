/**
 * Push Notification Service
 *
 * Handles Web Push notification subscriptions and sending.
 * Uses web-push library with VAPID authentication.
 */
import { randomUUIDv7 } from 'bun';
import webpush from 'web-push';
import { pushSubscriptions, eq, and } from '@repo/db';
import { configs } from '@/configs';
import { logger } from '@utils';
import type { DbClient } from '@/types';

// Configure web-push with VAPID keys (only if valid keys are provided)
const hasValidVapidKeys =
  configs.PUSH.VAPID_PUBLIC_KEY &&
  configs.PUSH.VAPID_PRIVATE_KEY &&
  configs.PUSH.VAPID_PUBLIC_KEY.length > 20 &&
  configs.PUSH.VAPID_PRIVATE_KEY.length > 20;

if (hasValidVapidKeys) {
  try {
    webpush.setVapidDetails(
      configs.PUSH.VAPID_SUBJECT,
      configs.PUSH.VAPID_PUBLIC_KEY,
      configs.PUSH.VAPID_PRIVATE_KEY
    );
    logger.push('Web Push configured with VAPID keys');
  } catch (error) {
    logger.error('Failed to configure VAPID keys:', { error: String(error) });
    logger.warn(
      'Push notifications will not work. Generate VAPID keys with: bunx web-push generate-vapid-keys'
    );
  }
} else {
  logger.warn('VAPID keys not configured. Push notifications disabled.');
  logger.warn('Generate keys with: bunx web-push generate-vapid-keys');
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface SubscribeInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
  deviceName?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

export interface SendResult {
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
}

export class PushService {
  constructor(private db: DbClient) {}

  /**
   * Check if push notifications are configured
   */
  isConfigured(): boolean {
    return !!(configs.PUSH.VAPID_PUBLIC_KEY && configs.PUSH.VAPID_PRIVATE_KEY);
  }

  /**
   * Get public VAPID key for client subscription
   */
  getVapidPublicKey(): string {
    return configs.PUSH.VAPID_PUBLIC_KEY;
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(
    userId: string,
    input: SubscribeInput
  ): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    try {
      // Check if subscription already exists for this endpoint
      const existing = this.db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.endpoint))
        .get();

      if (existing) {
        // Update existing subscription
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

        return { success: true, subscriptionId: existing.id };
      }

      // Create new subscription
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

      logger.app(`Push subscription created`, { userId, subscriptionId: id });
      return { success: true, subscriptionId: id };
    } catch (error) {
      logger.error(`Failed to create push subscription`, { userId, error: String(error) });
      return { success: false, error: 'Failed to save subscription' };
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(
    userId: string,
    endpoint: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));

      return { success: true };
    } catch (error) {
      logger.error(`Failed to unsubscribe`, { userId, error: String(error) });
      return { success: false, error: 'Failed to remove subscription' };
    }
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userId: string) {
    return this.db
      .select({
        id: pushSubscriptions.id,
        deviceName: pushSubscriptions.deviceName,
        deviceType: pushSubscriptions.deviceType,
        isActive: pushSubscriptions.isActive,
        createdAt: pushSubscriptions.createdAt,
        lastUsedAt: pushSubscriptions.lastUsedAt
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .all();
  }

  /**
   * Send push notification to a specific user
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { success: false, sent: 0, failed: 0, errors: ['Push not configured'] };
    }

    const subscriptions = this.db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)))
      .all();

    if (subscriptions.length === 0) {
      return { success: true, sent: 0, failed: 0 };
    }

    return this.sendToSubscriptions(subscriptions, payload);
  }

  /**
   * Send push notification to multiple subscriptions
   */
  private async sendToSubscriptions(
    subscriptions: Array<{
      id: string;
      endpoint: string;
      p256dhKey: string;
      authKey: string;
      failedAttempts: number;
    }>,
    payload: PushPayload
  ): Promise<SendResult> {
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dhKey,
            auth: sub.authKey
          }
        } as any;

        try {
          await webpush.sendNotification(pushSubscription, JSON.stringify(payload));

          // Update last used timestamp
          await this.db
            .update(pushSubscriptions)
            .set({
              lastUsedAt: new Date(),
              failedAttempts: 0
            })
            .where(eq(pushSubscriptions.id, sub.id));

          return { success: true, subscriptionId: sub.id };
        } catch (error: unknown) {
          const statusCode = (error as { statusCode?: number }).statusCode;

          // Handle expired or invalid subscriptions
          if (statusCode === 404 || statusCode === 410) {
            logger.app(`Removing expired subscription`, { subscriptionId: sub.id });
            await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          } else {
            // Increment failed attempts
            const newAttempts = sub.failedAttempts + 1;
            if (newAttempts >= configs.PUSH.MAX_FAILED_ATTEMPTS) {
              // Deactivate subscription after too many failures
              await this.db
                .update(pushSubscriptions)
                .set({ isActive: false, failedAttempts: newAttempts })
                .where(eq(pushSubscriptions.id, sub.id));
            } else {
              await this.db
                .update(pushSubscriptions)
                .set({ failedAttempts: newAttempts })
                .where(eq(pushSubscriptions.id, sub.id));
            }
          }

          throw error;
        }
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => String(r.reason));

    return { success: sent > 0, sent, failed, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * Send push notification to all active subscriptions (e.g., for admin broadcasts)
   */
  async broadcast(payload: PushPayload): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { success: false, sent: 0, failed: 0, errors: ['Push not configured'] };
    }

    const subscriptions = this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.isActive, true))
      .all();

    if (subscriptions.length === 0) {
      return { success: true, sent: 0, failed: 0 };
    }

    return this.sendToSubscriptions(subscriptions, payload);
  }

  /**
   * Cleanup inactive/expired subscriptions
   */
  async cleanup(): Promise<number> {
    const result = await this.db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.isActive, false));

    return 0; // SQLite doesn't return affected rows count easily
  }
}
