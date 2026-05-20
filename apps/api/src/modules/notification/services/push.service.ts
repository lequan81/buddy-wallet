/**
 * Push Notification Service — API Side
 * @logicType backend
 *
 * Enqueues push notification jobs to Redis for the worker to process.
 * Does NOT send push directly — the dedicated worker handles delivery.
 *
 * Queue: `push_notifications`
 */
import { log } from '@repo/logger';
import { enqueueJob, createWorkerJob } from '@/providers/redis/queue';
import { isRedisAvailable } from '@/providers/redis/connection';
import type { PushPayload } from '../types/push';

/**
 * Enqueue a push notification job for a specific user.
 * Fire-and-forget — returns immediately. The worker will deliver.
 */
export async function enqueuePush(userId: string, payload: PushPayload): Promise<boolean> {
  if (!isRedisAvailable()) {
    log.debug('PUSH', 'Redis unavailable, skipping push enqueue', { userId });
    return false;
  }

  try {
    const jobPayload = createWorkerJob('notification', {
      userId,
      fileName: '', // Not applicable for push notifications
      storageKey: '',
      config: payload as unknown as Record<string, unknown>,
      previewLogId: undefined
    });

    const queued = await enqueueJob('push_notifications', jobPayload as unknown as Record<string, unknown>);
    if (!queued) {
      log.warn('PUSH', 'Queue unavailable, push enqueue deferred', { userId });
      return false;
    }
    log.debug('PUSH', 'Push job enqueued', { userId, jobId: jobPayload.jobId });
    return true;
  } catch (err) {
    log.error('PUSH', 'Failed to enqueue push job', { userId, error: String(err) });
    return false;
  }
}
