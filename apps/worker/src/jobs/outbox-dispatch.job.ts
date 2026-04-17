import { logger } from '@repo/logger';
import { db, outboxEvents, and, asc, eq, lte } from '@repo/db';

const DEFAULT_OUTBOX_BATCH_SIZE = 25;
const RETRY_BASE_DELAY_MS = 5_000;
const RETRY_MAX_DELAY_MS = 60_000;

export interface OutboxDispatchResult {
  scanned: number;
  published: number;
  retried: number;
  failed: number;
}

function getRetryDelayMs(attempts: number): number {
  return Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, Math.max(0, attempts - 1)), RETRY_MAX_DELAY_MS);
}

/**
 * Placeholder publisher for outbox events.
 * Real transport fan-out should replace this in follow-up phases.
 */
async function publishOutboxEvent(event: typeof outboxEvents.$inferSelect): Promise<void> {
  logger.info('[Outbox] Dispatch placeholder', {
    eventId: event.id,
    eventType: event.eventType,
    aggregateType: event.aggregateType ?? null,
    aggregateId: event.aggregateId ?? null
  });
}

/**
 * Dispatch a single outbox batch and update persistence status.
 */
export async function dispatchOutboxBatch(
  batchSize: number = DEFAULT_OUTBOX_BATCH_SIZE
): Promise<OutboxDispatchResult> {
  const now = new Date();
  const queuedEvents = await db
    .select()
    .from(outboxEvents)
    .where(and(eq(outboxEvents.status, 'pending'), lte(outboxEvents.availableAt, now)))
    .orderBy(asc(outboxEvents.availableAt), asc(outboxEvents.createdAt))
    .limit(Math.max(1, batchSize));

  const result: OutboxDispatchResult = {
    scanned: queuedEvents.length,
    published: 0,
    retried: 0,
    failed: 0
  };

  for (const event of queuedEvents) {
    try {
      await db
        .update(outboxEvents)
        .set({
          status: 'processing',
          updatedAt: new Date()
        })
        .where(eq(outboxEvents.id, event.id));

      await publishOutboxEvent(event);

      await db
        .update(outboxEvents)
        .set({
          status: 'published',
          processedAt: new Date(),
          updatedAt: new Date(),
          lastError: null
        })
        .where(eq(outboxEvents.id, event.id));

      result.published++;
    } catch (error: unknown) {
      const nextAttempts = event.attempts + 1;
      const exhausted = nextAttempts >= event.maxAttempts;
      const nextAvailableAt = exhausted
        ? event.availableAt
        : new Date(Date.now() + getRetryDelayMs(nextAttempts));

      await db
        .update(outboxEvents)
        .set({
          status: exhausted ? 'failed' : 'pending',
          attempts: nextAttempts,
          availableAt: nextAvailableAt,
          updatedAt: new Date(),
          lastError: String(error).slice(0, 500)
        })
        .where(eq(outboxEvents.id, event.id));

      if (exhausted) {
        result.failed++;
      } else {
        result.retried++;
      }

      logger.warn('[Outbox] Dispatch failed', {
        eventId: event.id,
        attempts: nextAttempts,
        exhausted,
        error: String(error)
      });
    }
  }

  return result;
}
