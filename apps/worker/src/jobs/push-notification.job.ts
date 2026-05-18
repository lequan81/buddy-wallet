/**
 * Push Notification Job Processor
 *
 * Runs inside apps/worker, picks up push notification jobs from Redis queue
 * and sends them via web-push. The API enqueues jobs; the worker processes them.
 *
 * Queue name: `push_notifications`
 * Payload shape: { userId, payload: { title, body, url?, icon? } }
 */
import webPush from 'web-push';
import { logger } from '@repo/logger';
import { db, pushSubscriptions, eq, and } from '@repo/db';
import { env } from '@repo/config';

// ── VAPID Initialization ────────────────────────────────────
const VAPID_PUBLIC_KEY = env.string('VAPID_PUBLIC_KEY', '');
const VAPID_PRIVATE_KEY = env.string('VAPID_PRIVATE_KEY', '');
const VAPID_SUBJECT = env.string('VAPID_SUBJECT', 'mailto:admin@buddywallet.com');

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger.warn('[Push] VAPID keys not configured — push notifications disabled');
    return false;
  }
  try {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
    return true;
  } catch (err) {
    logger.error('[Push] Failed to set VAPID details', { error: String(err) });
    return false;
  }
}

// ── Types ────────────────────────────────────────────────────
export interface PushJobPayload {
  userId: string;
  payload: {
    title: string;
    body: string;
    url?: string;
    icon?: string;
  };
}

interface SubscriptionRow {
  id: string;
  userId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  isActive: boolean;
  failedAttempts: number;
}

// ── Send to single subscription ──────────────────────────────
async function sendToSubscription(
  sub: SubscriptionRow,
  payload: PushJobPayload['payload']
): Promise<boolean> {
  try {
    await webPush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dhKey, auth: sub.authKey }
      },
      JSON.stringify(payload)
    );

    // Update last used + reset failures
    await db
      .update(pushSubscriptions)
      .set({ lastUsedAt: new Date(), failedAttempts: 0, updatedAt: new Date() })
      .where(eq(pushSubscriptions.id, sub.id));

    return true;
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;

    // 410 Gone = subscription expired/invalid → deactivate
    if (statusCode === 410) {
      logger.info('[Push] Subscription expired, deactivating', { subId: sub.id, endpoint: sub.endpoint });
      await db
        .update(pushSubscriptions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(pushSubscriptions.id, sub.id));
      return false;
    }

    // Increment failure count
    const newFailures = (sub.failedAttempts || 0) + 1;
    const updates: Record<string, unknown> = {
      failedAttempts: newFailures,
      updatedAt: new Date()
    };

    // Deactivate after 5 consecutive failures
    if (newFailures >= 5) {
      updates.isActive = false;
      logger.warn('[Push] Subscription deactivated after 5 failures', { subId: sub.id });
    }

    await db
      .update(pushSubscriptions)
      .set(updates)
      .where(eq(pushSubscriptions.id, sub.id));

    logger.push('Push send failed', {
      error: String(error),
      statusCode,
      subId: sub.id,
      endpoint: sub.endpoint
    });

    return false;
  }
}

// ── Main Job Processor ───────────────────────────────────────
export async function processPushJob(payload: PushJobPayload): Promise<void> {
  if (!ensureVapid()) {
    logger.warn('[Push] Skipping push job — VAPID not configured', { userId: payload.userId });
    return;
  }

  const { userId, payload: pushPayload } = payload;

  // Fetch active subscriptions for user
  const subs = (await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)))
    .all()) as SubscriptionRow[];

  if (subs.length === 0) {
    logger.debug('[Push] No active subscriptions for user', { userId });
    return;
  }

  // Send to all subscriptions in parallel
  const results = await Promise.allSettled(
    subs.map((sub) => sendToSubscription(sub, pushPayload))
  );

  const sent = results.filter(
    (r) => r.status === 'fulfilled' && r.value === true
  ).length;
  const failed = results.length - sent;

  logger.push('Push batch complete', { userId, sent, failed, total: subs.length });
}
