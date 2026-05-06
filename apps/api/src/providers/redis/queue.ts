/**
 * Redis Queue Provider
 * @logicType infrastructure
 *
 * Simple job queue using Redis lists (LPUSH/BRPOP) and hashes.
 * No external dependencies — uses native Bun RedisClient.
 *
 * Key patterns:
 *   bw:queue:{name}       — Redis list for job IDs
 *   bw:job:{jobId}        — Redis hash for job data + progress
 */
import { randomUUIDv7 } from 'bun';
import { log } from '@repo/logger';
import { getClient, isRedisAvailable } from './connection';
import { circuitBreaker } from './circuit-breaker';

export interface QueueJob {
  id: string;
  type: 'import-process' | 'push-notification';
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
}

const JOB_HASH_TTL = 3600; // 1 hour

/**
 * Enqueue a job: store metadata in hash + push ID to list
 */
export async function enqueueJob(queueName: string, job: QueueJob): Promise<void> {
  if (!isRedisAvailable()) throw new Error('Redis not available');
  const client = getClient();
  if (!client) throw new Error('Redis client not available');

  const queueKey = `bw:queue:${queueName}`;
  const jobKey = `bw:job:${job.id}`;

  try {
    await client.send('HSET', [
      jobKey,
      'data', JSON.stringify(job),
      'status', 'queued',
      'progress', '{}'
    ]);
    await client.send('EXPIRE', [jobKey, String(JOB_HASH_TTL)]);

    await client.send('LPUSH', [queueKey, job.id]);

    circuitBreaker.trackCommand(true);
    log.info('REDIS_QUEUE', `Job enqueued: ${job.id} → ${queueName}`);
  } catch (err) {
    circuitBreaker.trackCommand(false);
    log.error('REDIS_QUEUE', 'Failed to enqueue job', { error: String(err), jobId: job.id });
    throw err;
  }
}

/**
 * Dequeue a job: blocking pop from list (BRPOP with timeout)
 * Returns null if timeout expires with no jobs.
 */
export async function dequeueJob(queueName: string, timeoutSeconds: number = 5): Promise<QueueJob | null> {
  if (!isRedisAvailable()) return null;
  const client = getClient();
  if (!client) return null;

  const queueKey = `bw:queue:${queueName}`;

  try {
    const result = await client.send('BRPOP', [queueKey, String(timeoutSeconds)]);
    circuitBreaker.trackCommand(true);

    if (!result) return null;

    // BRPOP returns [key, value] array
    const jobId = Array.isArray(result) ? String(result[1]) : String(result);
    if (!jobId) return null;

    // Fetch full job data from hash
    const jobData = await client.send('HGET', [`bw:job:${jobId}`, 'data']);
    circuitBreaker.trackCommand(true);

    if (!jobData) return null;

    const job = JSON.parse(String(jobData)) as QueueJob;
    job.attempts += 1;
    return job;
  } catch (err) {
    circuitBreaker.trackCommand(false);
    log.error('REDIS_QUEUE', 'Failed to dequeue job', { error: String(err) });
    return null;
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
 * Helper: create a new job with generated ID
 */
export function createJob(
  type: QueueJob['type'],
  payload: Record<string, unknown>,
  maxAttempts: number = 3
): QueueJob {
  return {
    id: randomUUIDv7(),
    type,
    payload,
    attempts: 0,
    maxAttempts,
    createdAt: new Date().toISOString()
  };
}
