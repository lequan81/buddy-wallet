/**
 * Import Background Worker
 * @logicType worker
 *
 * Runs as a separate Bun process: `bun run src/workers/import.worker.ts`
 *
 * Polls the Redis queue `bw:queue:imports` using BRPOP, processes
 * import jobs in batches of 50, and publishes progress via Redis pub/sub.
 *
 * Job payload shape:
 *   { logId, userId, s3Key, columnMapping, startRow, totalRows }
 */
import { randomUUIDv7 } from 'bun';
import { log } from '@repo/logger';
import { db } from '@/providers/database';
import { ImportRepository } from '@/repositories/data/import.repo';
import { importStorage } from '@/providers/storage/storage';
import { normalizePhoneNumber } from '@repo/utils';
import { initRedis, closeRedis } from '@/providers/redis/connection';
import {
  dequeueJob,
  updateJobProgress,
  publishProgress,
  type QueueJob
} from '@/providers/redis/queue';

const QUEUE_NAME = 'imports';
const BATCH_SIZE = 50;
const POLL_TIMEOUT = 5; // seconds

const importRepo = new ImportRepository(db);

// ─── Row Processing ────────────────────────────────────────────────

interface DebtRow {
  debtorPhone?: string;
  creditorPhone?: string;
  amount?: number;
  currency?: string;
  description?: string;
  dueDate?: string;
  [key: string]: unknown;
}

function validateRow(row: DebtRow, index: number): string | null {
  if (!row.debtorPhone && !row.creditorPhone) {
    return `Row ${index + 1}: Missing debtorPhone or creditorPhone`;
  }
  if (!row.amount || row.amount <= 0) {
    return `Row ${index + 1}: Invalid amount (${row.amount})`;
  }
  return null;
}

async function processBatch(
  rows: DebtRow[],
  userId: string,
  startIndex: number
): Promise<{ imported: number; errors: string[] }> {
  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const globalIndex = startIndex + i;

    const validationError = validateRow(row, globalIndex);
    if (validationError) {
      errors.push(validationError);
      continue;
    }

    try {
      const debtorPhone = normalizePhoneNumber(row.debtorPhone || '') || row.debtorPhone || '';
      const creditorPhone = normalizePhoneNumber(row.creditorPhone || '') || row.creditorPhone || '';

      await importRepo.createDebtsBatch([{
        id: randomUUIDv7(),
        debtorPhone,
        creditorPhone,
        debtorId: null,
        creditorId: null,
        uploadedById: userId,
        amount: row.amount!,
        currency: (row.currency || 'VND').toUpperCase(),
        description: row.description || null,
        status: 'pending' as const,
        confirmedByCreditor: false,
        confirmedByDebtor: false,
        needsConfirmation: true,
        hasPendingProof: false,
        proofCount: 0,
        expiresAt: row.dueDate ? new Date(row.dueDate) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      }]);

      imported++;
    } catch (err) {
      errors.push(`Row ${globalIndex + 1}: ${String(err)}`);
    }
  }

  return { imported, errors };
}

// ─── Job Processing ────────────────────────────────────────────────

interface ImportJobPayload {
  logId: string;
  userId: string;
  s3Key?: string;
  columnMapping?: Record<string, string>;
  startRow?: number;
  totalRows: number;
  directData?: DebtRow[];
}

async function processImportJob(job: QueueJob): Promise<void> {
  const payload = job.payload as unknown as ImportJobPayload;
  const { logId, userId, s3Key, columnMapping, startRow = 1, totalRows, directData } = payload;
  const progressChannel = `bw:import:progress:${logId}`;

  log.info('IMPORT_WORKER', `Processing job ${job.id} for log ${logId} (${totalRows} rows)`);

  // Update status to processing
  await updateJobProgress(logId, {
    status: 'processing',
    current: 0,
    total: totalRows,
    percentage: 0,
    message: 'Starting import...'
  });
  await publishProgress(progressChannel, {
    logId,
    data: { status: 'processing', current: 0, total: totalRows, percentage: 0 }
  });

  // Resolve rows to process — either from S3 (preview flow) or direct data (legacy flow)
  let rowsToProcess: DebtRow[];

  if (directData && directData.length > 0) {
    // Legacy flow: rows passed directly in job payload
    rowsToProcess = directData;
  } else if (s3Key && columnMapping) {
    // Preview flow: read from S3 and apply column mapping
    let parsedData: { headers: string[]; rows: Record<string, unknown>[]; totalRows: number };
    try {
      const buffer = await importStorage.read(s3Key);
      parsedData = JSON.parse(buffer.toString());
    } catch (err) {
      log.error('IMPORT_WORKER', `Failed to read S3 data for log ${logId}`, { error: String(err) });
      throw new Error(`S3 read failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const { applyColumnMapping } = await import('@/modules/data/services/import-preview.service');
    rowsToProcess = applyColumnMapping(parsedData.rows, columnMapping, startRow);
  } else {
    throw new Error(`Job ${job.id}: No data source (neither directData nor s3Key+columnMapping)`);
  }

  if (rowsToProcess.length === 0) {
    await importRepo.updateLog(logId, {
      status: 'failed',
      errorCount: 0,
      errors: JSON.stringify(['No valid rows to process']),
      completedAt: new Date()
    });
    await updateJobProgress(logId, {
      status: 'failed',
      current: 0,
      total: 0,
      percentage: 0,
      message: 'No valid rows to process'
    });
    await publishProgress(progressChannel, {
      logId,
      data: { status: 'failed', current: 0, total: 0, percentage: 0, message: 'No valid rows' }
    });
    return;
  }

  // Process in batches
  let totalImported: number = 0;
  const totalErrors: string[] = [];

  for (let i = 0; i < rowsToProcess.length; i += BATCH_SIZE) {
    const batch = rowsToProcess.slice(i, i + BATCH_SIZE);
    const result = await processBatch(batch, userId, i);
    totalImported += result.imported;
    totalErrors.push(...result.errors);

    const processed = Math.min(i + BATCH_SIZE, rowsToProcess.length);
    const percentage = Math.round((processed / rowsToProcess.length) * 100);

    // Update progress in Redis hash
    await updateJobProgress(logId, {
      status: 'processing',
      current: processed,
      total: rowsToProcess.length,
      percentage,
      imported: totalImported,
      errors: totalErrors.length
    });

    // Publish to pub/sub for SSE
    await publishProgress(progressChannel, {
      logId,
      data: {
        status: 'processing',
        current: processed,
        total: rowsToProcess.length,
        percentage,
        imported: totalImported,
        errors: totalErrors.length
      }
    });

    log.info('IMPORT_WORKER', `Batch ${Math.floor(i / BATCH_SIZE) + 1} done for log ${logId}`, {
      processed,
      total: rowsToProcess.length,
      percentage
    });
  }

  // Determine final status
  const finalStatus = totalErrors.length === rowsToProcess.length ? 'failed' : 'success';

  // Update import log in DB
  await importRepo.updateLog(logId, {
    status: finalStatus,
    importedCount: totalImported,
    errorCount: totalErrors.length,
    errors: totalErrors.length > 0 ? JSON.stringify(totalErrors.slice(0, 50)) : null,
    completedAt: new Date()
  });

  // Final progress update
  const finalProgress = {
    status: finalStatus,
    current: rowsToProcess.length,
    total: rowsToProcess.length,
    percentage: 100,
    imported: totalImported,
    errors: totalErrors.length,
    message: `Import completed: ${totalImported} imported, ${totalErrors.length} failed`
  };
  await updateJobProgress(logId, finalProgress);
  await publishProgress(progressChannel, { logId, data: finalProgress });

  log.info('IMPORT_WORKER', `Job ${job.id} completed for log ${logId}`, {
    imported: totalImported,
    errors: totalErrors.length,
    importStatus: finalStatus
  });
}

// ─── Worker Loop ───────────────────────────────────────────────────

let running = true;

async function workerLoop(): Promise<void> {
  log.info('IMPORT_WORKER', 'Worker started, polling for jobs...');

  while (running) {
    try {
      const job = await dequeueJob(QUEUE_NAME, POLL_TIMEOUT);

      if (!job) continue;

      try {
        await processImportJob(job);
      } catch (err) {
        log.error('IMPORT_WORKER', `Job ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts})`, {
          error: String(err)
        });

        // Retry if under max attempts
        if (job.attempts < job.maxAttempts) {
          const { enqueueJob } = await import('@/providers/redis/queue');
          await enqueueJob(QUEUE_NAME, job);
          log.info('IMPORT_WORKER', `Job ${job.id} re-enqueued for retry`);
        } else {
          // Mark as failed in DB
          const payload = job.payload as unknown as ImportJobPayload;
          await importRepo.updateLog(payload.logId, {
            status: 'failed',
            errorCount: 1,
            errors: JSON.stringify([`Worker error after ${job.maxAttempts} attempts: ${String(err)}`]),
            completedAt: new Date()
          });
          await updateJobProgress(payload.logId, {
            status: 'failed',
            message: `Failed after ${job.maxAttempts} attempts`
          });
          await publishProgress(`bw:import:progress:${payload.logId}`, {
            logId: payload.logId,
            data: { status: 'failed', current: 0, total: payload.totalRows, percentage: 0, message: 'Max retries exceeded' }
          });
        }
      }
    } catch (err) {
      // Queue-level error (e.g., Redis down) — back off
      log.error('IMPORT_WORKER', 'Worker loop error', { error: String(err) });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// ─── Graceful Shutdown ─────────────────────────────────────────────

function shutdown(signal: string) {
  log.info('IMPORT_WORKER', `Received ${signal}, shutting down...`);
  running = false;
  closeRedis();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ─── Entry Point ───────────────────────────────────────────────────

export async function startImportWorker(): Promise<void> {
  const connected = await initRedis();
  if (!connected) {
    log.error('IMPORT_WORKER', 'Failed to connect to Redis, exiting');
    process.exit(1);
  }

  await workerLoop();
}
