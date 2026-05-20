/**
 * Redis Queue Provider
 * @logicType infrastructure
 *
 * Simple job queue using Redis lists (LPUSH/BRPOP) and hashes.
 * No external dependencies - uses native Bun RedisClient.
 *
 * Key patterns:
 *   bw:queue:{name}       - Redis list for job payloads (direct JSON)
 *   bw:job:{jobId}        - Redis hash for job progress tracking
 *
 * NOTE: This sends jobs in the format expected by apps/worker (WorkerJobPayload)
 * to enable consolidation and eliminate duplication.
 */
import { log } from '@repo/logger';
import type { WorkerJobPayload } from '@repo/types';
import { withRetry } from '@repo/utils';
import { getClient, isRedisAvailable } from './connection';
import { circuitBreaker } from './circuit-breaker';
import { randomUUIDv7 } from 'bun';

const JOB_HASH_TTL = 3600; // 1 hour

/**
 * Enqueue a job: push payload directly to list (format expected by apps/worker)
 * This matches the WorkerJobPayload interface from @repo/types.
 *
 * Returns true when enqueued to Redis, false when Redis is unavailable or enqueue fails.
 */
export async function enqueueJob(queueName: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!isRedisAvailable()) {
    log.warn('REDIS_QUEUE', 'Redis not available, queue enqueue deferred', { queueName });
    return false;
  }

  const client = getClient();
  if (!client) {
    log.warn('REDIS_QUEUE', 'Redis client not available, queue enqueue deferred', { queueName });
    return false;
  }

  const queueKey = `bw:queue:${queueName}`;
  const jobId = payload.jobId as string;

  try {
    await withRetry(
      async () => {
        // Initialize job hash for progress tracking
        if (jobId) {
          await client.send('HSET', [
            `bw:job:${jobId}`,
            'status', 'queued',
            'progress', '{}'
          ]);
          await client.send('EXPIRE', [`bw:job:${jobId}`, String(JOB_HASH_TTL)]);
        }

        // Push payload directly to queue (apps/worker expects flat JSON object)
        await client.send('LPUSH', [queueKey, JSON.stringify(payload)]);
      },
      {
        maxAttempts: 3,
        baseDelayMs: 150,
        maxDelayMs: 1000,
        onRetry: (error, attempt) => {
          log.warn('REDIS_QUEUE', 'Retrying enqueue operation', {
            queueName,
            jobId,
            attempt,
            error: String(error)
          });
        }
      }
    );

    circuitBreaker.trackCommand(true);
    log.info('REDIS_QUEUE', `Job enqueued: ${jobId} -> ${queueName}`);
    return true;
  } catch (err) {
    circuitBreaker.trackCommand(false);
    log.error('REDIS_QUEUE', 'Failed to enqueue job', { error: String(err), jobId, queueName });
    return false;
  }
}

/**
 * Get full job status from Redis hash
 */
export async function getJobStatus(jobId: string): Promise<Record<string, unknown> | null> {
  if (!isRedisAvailable()) return null;
  const client = getClient();
  if (!client) return null;

  const jobKey = `bw:job:${jobId}`;

  try {
    const fields = await client.send('HGETALL', [jobKey]);
    circuitBreaker.trackCommand(true);

    if (!fields || (Array.isArray(fields) && fields.length === 0)) return null;

    const result: Record<string, unknown> = {};
    const arr = Array.isArray(fields) ? fields : [];
    for (let i = 0; i < arr.length; i += 2) {
      const key = String(arr[i]);
      const value = String(arr[i + 1]);
      if (key === 'data' || key === 'progress') {
        try { result[key] = JSON.parse(value); } catch { result[key] = value; }
      } else {
        result[key] = value;
      }
    }

    return result;
  } catch (err) {
    circuitBreaker.trackCommand(false);
    log.error('REDIS_QUEUE', 'Failed to get job status', { error: String(err), jobId });
    return null;
  }
}

/**
 * Update job progress fields in Redis hash
 */
export async function updateJobProgress(
  jobId: string,
  progress: Record<string, unknown>
): Promise<void> {
  if (!isRedisAvailable()) return;
  const client = getClient();
  if (!client) return;

  const jobKey = `bw:job:${jobId}`;

  try {
    await client.send('HSET', [
      jobKey,
      'progress', JSON.stringify(progress),
      'status', String(progress.status || 'processing')
    ]);
    await client.send('EXPIRE', [jobKey, String(JOB_HASH_TTL)]);
    circuitBreaker.trackCommand(true);
  } catch (err) {
    circuitBreaker.trackCommand(false);
    log.error('REDIS_QUEUE', 'Failed to update job progress', { error: String(err), jobId });
  }
}

/**
 * Publish progress to a Redis pub/sub channel
 */
export async function publishProgress(channel: string, data: Record<string, unknown>): Promise<void> {
  if (!isRedisAvailable()) return;
  const client = getClient();
  if (!client) return;

  try {
    await client.send('PUBLISH', [channel, JSON.stringify(data)]);
    circuitBreaker.trackCommand(true);
  } catch (err) {
    circuitBreaker.trackCommand(false);
    log.error('REDIS_QUEUE', 'Failed to publish progress', { error: String(err), channel });
  }
}

/**
 * Helper: create a WorkerJobPayload for apps/worker
 * This matches the WorkerJobPayload interface from @repo/types
 */
export function createWorkerJob(
  type: 'import' | 'preview' | 'notification' | 'image_processing',
  payload: Omit<WorkerJobPayload, 'type' | 'jobId'>
): WorkerJobPayload {
  return {
    type,
    jobId: randomUUIDv7(),
    ...payload
  };
}
