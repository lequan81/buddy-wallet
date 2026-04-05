/**
 * Push Notification Service
 *
 * Handles Web Push notification subscriptions and sending.
 * Uses web-push library with VAPID authentication.
 */
import webpush from 'web-push';
import { logger } from '@repo/logger';
import type { INotificationRepository } from '@/types/repositories';
import { configs } from '@/configs';
import type { PushPayload, SubscribeInput, SendResult } from '@/types/push';

export class PushService {
  private readonly PUSH_CHUNK_SIZE = 100;
  private static vapidConfigured = false;

  constructor(private notificationRepo: INotificationRepository) {
    if (!PushService.vapidConfigured) {
      this.configureVapid();
      PushService.vapidConfigured = true;
    }
  }

  private configureVapid(): void {
    const hasValidKeys =
      configs.PUSH.VAPID_PUBLIC_KEY &&
      configs.PUSH.VAPID_PRIVATE_KEY &&
      configs.PUSH.VAPID_PUBLIC_KEY.length > 20 &&
      configs.PUSH.VAPID_PRIVATE_KEY.length > 20;

    if (hasValidKeys) {
      try {
        webpush.setVapidDetails(
          configs.PUSH.VAPID_SUBJECT,
          configs.PUSH.VAPID_PUBLIC_KEY,
          configs.PUSH.VAPID_PRIVATE_KEY
        );
        logger.push('Web Push configured with VAPID keys');
      } catch (error) {
        logger.error('Failed to configure VAPID keys:', { error: String(error) });
      }
    } else {
      logger.warn('VAPID keys not configured. Push notifications disabled.');
    }
  }

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
      const subscriptionId = await this.notificationRepo.upsertSubscription(userId, input);
      logger.app(`Push subscription created/updated`, { userId, subscriptionId });
      return { success: true, subscriptionId };
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
      await this.notificationRepo.deleteSubscription(userId, endpoint);
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
    const subs = await this.notificationRepo.getSubscriptionsByUserId(userId, false);
    return subs.map(s => ({
      id: s.id,
      deviceName: s.deviceName,
      deviceType: s.deviceType,
      isActive: s.isActive,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt
    }));
  }

  /**
   * Send push notification to a specific user
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { success: false, sent: 0, failed: 0, errors: ['Push not configured'] };
    }

    const subscriptions = await this.notificationRepo.getSubscriptionsByUserId(userId, true);

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
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < subscriptions.length; i += this.PUSH_CHUNK_SIZE) {
      const chunk = subscriptions.slice(i, Math.min(i + this.PUSH_CHUNK_SIZE, subscriptions.length));

      const chunkResults = await Promise.allSettled(
        chunk.map(async (sub) => {
          const pushSubscription: {
            endpoint: string;
            keys: {
              p256dh: string;
              auth: string;
            };
          } = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dhKey,
              auth: sub.authKey
            }
          };

          try {
            await webpush.sendNotification(pushSubscription, JSON.stringify(payload));

            await this.notificationRepo.updateSubscriptionStatus(sub.id, {
              lastUsedAt: new Date(),
              failedAttempts: 0
            });

            return { success: true, subscriptionId: sub.id };
          } catch (error: unknown) {
            const statusCode = (error as { statusCode?: number }).statusCode;

            if (statusCode === 404 || statusCode === 410) {
              logger.app(`Removing expired subscription`, { subscriptionId: sub.id });
              await this.notificationRepo.deleteById(sub.id);
            } else {
              const newAttempts = sub.failedAttempts + 1;
              const isActive = newAttempts < configs.PUSH.MAX_FAILED_ATTEMPTS;
              await this.notificationRepo.updateSubscriptionStatus(sub.id, {
                isActive,
                failedAttempts: newAttempts
              });
            }

            throw error;
          }
        })
      );

      sent += chunkResults.filter((r) => r.status === 'fulfilled').length;
      const failedInChunk = chunkResults.filter((r) => r.status === 'rejected');
      failed += failedInChunk.length;
      errors.push(...failedInChunk.map((r) => String((r as PromiseRejectedResult).reason)));

      if (i + this.PUSH_CHUNK_SIZE < subscriptions.length) {
        await this.sleep(10);
      }
    }

    return {
      success: sent > 0,
      sent,
      failed,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined
    };
  }

  /**
   * Send push notification to all active subscriptions (e.g., for admin broadcasts)
   */
  async broadcast(payload: PushPayload): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { success: false, sent: 0, failed: 0, errors: ['Push not configured'] };
    }

    const subscriptions = await this.notificationRepo.getAllActiveSubscriptions();

    if (subscriptions.length === 0) {
      return { success: true, sent: 0, failed: 0 };
    }

    const result = await this.sendToSubscriptions(subscriptions, payload);
    logger.info('Push broadcast completed', {
      total: subscriptions.length,
      sent: result.sent,
      failed: result.failed
    });
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup inactive/expired subscriptions
   */
  async cleanup(): Promise<number> {
    return this.notificationRepo.cleanupInactive(30); // 30 days is a good default
  }

  /**
   * Send notification when a new debt is created
   */
  async sendDebtCreatedNotification(params: {
    userId: string;
    creatorName: string;
    amount: number;
    description: string;
    debtId: string;
    isCreditor: boolean;
  }): Promise<SendResult> {
    const { userId, creatorName, amount, description, debtId, isCreditor } = params;

    const formattedAmount = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount);

    const message = isCreditor
      ? `${creatorName} says you owe ${formattedAmount} for "${description}"`
      : `${creatorName} says they owe you ${formattedAmount} for "${description}"`;

    return this.sendToUser(userId, {
      title: 'New Debt Recorded',
      body: message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `debt-${debtId}`,
      url: `/debts/${debtId}`,
      data: { debtId, type: 'debt_created' },
      requireInteraction: true
    });
  }

  /**
   * Send notification when a debt is confirmed by counterparty
   */
  async sendDebtConfirmedNotification(params: {
    userId: string;
    confirmerName: string;
    amount: number;
    description: string;
    debtId: string;
  }): Promise<SendResult> {
    const { userId, confirmerName, amount, description, debtId } = params;

    const formattedAmount = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount);

    return this.sendToUser(userId, {
      title: 'Debt Confirmed',
      body: `${confirmerName} has confirmed the debt of ${formattedAmount} for "${description}"`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `debt-confirmed-${debtId}`,
      url: `/debts/${debtId}`,
      data: { debtId, type: 'debt_confirmed' }
    });
  }
}
