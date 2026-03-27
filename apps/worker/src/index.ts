/**
 * Import Worker - Background Job Processor
 *
 * Runs as a separate Bun process in apps/worker workspace.
 */
import { RedisClient } from 'bun';
import { logger } from '@repo/logger';
import ExcelJS from 'exceljs';
import { db, debts, users, importLogs, eq, or, inArray } from '@repo/db';
import { randomUUIDv7 } from 'bun';
import * as fs from 'node:fs/promises';
import { MAX_IMPORT_ROWS, REDIS_CONFIG, buildRedisUrl, getRedisOptions } from '@repo/config';
import type { WorkerJobPayload, ImportProgress } from '@repo/types';

// ── Connection State ───────────────────────────────────────
let redisClient: RedisClient | null = null;
let connectionHealthy = false;

async function initRedis(): Promise<boolean> {
  if (!REDIS_CONFIG.ENABLED) {
    logger.info('[Worker] Redis disabled');
    return false;
  }

  const redisUrl = buildRedisUrl();
  if (!redisUrl) {
    logger.warn('[Worker] Redis URL not configured');
    return false;
  }

  try {
    const client = new RedisClient(redisUrl, getRedisOptions());

    client.onconnect = () => {
      logger.info('[Worker] Redis connected');
      connectionHealthy = true;
    };

    client.onclose = (error: Error | undefined) => {
      connectionHealthy = false;
      if (error) {
        logger.error('[Worker] Redis connection error', { error: String(error) });
      }
    };

    // Test connection before returning
    await client.set('_health', 'ok');
    await client.del('_health');

    redisClient = client;
    connectionHealthy = true;
    logger.info('[Worker] Redis ready', { host: REDIS_CONFIG.HOST, port: REDIS_CONFIG.PORT });
    return true;

  } catch (err) {
    logger.error('[Worker] Redis init failed', { error: String(err) });
    return false;
  }
}

function getRedis(): RedisClient {
  if (!redisClient || !connectionHealthy) {
    throw new Error('Redis not connected');
  }
  return redisClient;
}

// ── Circuit Breaker ────────────────────────────────────────
let redisFailures = 0;
let lastFailure = 0;
const MAX_FAILURES = 3;
const CIRCUIT_RESET_MS = 60_000;

function isRedisHealthy(): boolean {
  if (redisFailures >= MAX_FAILURES) {
    if (Date.now() - lastFailure > CIRCUIT_RESET_MS) {
      redisFailures = 0;
      logger.info('[Worker] Circuit breaker reset');
      return true;
    }
    return false;
  }
  return connectionHealthy;
}

function onRedisSuccess(): void {
  if (redisFailures > 0) redisFailures--;
}

function onRedisFailure(err: unknown): void {
  redisFailures++;
  lastFailure = Date.now();
  logger.error('[Worker] Redis operation failed', { error: String(err) });
}

// ── Throttled Progress Updates ──────────────────────────────
const lastProgressUpdate = new Map<string, number>();
const PROGRESS_THROTTLE_MS = 1000;

function setProgress(logId: string, progress: ImportProgress): void {
  if (!isRedisHealthy()) return;

  const now = Date.now();
  const last = lastProgressUpdate.get(logId) || 0;

  const isStatusChange = progress.status !== 'processing';
  if (!isStatusChange && now - last < PROGRESS_THROTTLE_MS) {
    return;
  }
  lastProgressUpdate.set(logId, now);

  try {
    const redis = getRedis();
    redis
      .send('SETEX', [`bw:import:${logId}`, '3600', JSON.stringify(progress)])
      .then(() => onRedisSuccess())
      .catch((err) => onRedisFailure(err));
  } catch {
    // Redis not available
  }
}

// ── Payload Validation ─────────────────────────────────────
function validatePayload(raw: unknown): raw is WorkerJobPayload {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;
  return (
    typeof p.jobId === 'string' &&
    typeof p.fileName === 'string' &&
    (p.type === 'preview' || p.type === 'import') &&
    (typeof p.userId === 'string' || (typeof p.userId === 'object' && p.userId !== null))
  );
}

// ── Cell Value Helper ─────────────────────────────────────
const colLetterToIndex = (col: string): number => {
  const letterPart = col.includes(':') ? col.split(':')[0].toUpperCase() : col.toUpperCase();
  let idx = 0;
  for (let i = 0; i < letterPart.length; i++) {
    idx = idx * 26 + (letterPart.charCodeAt(i) - 64);
  }
  return idx;
};

// ── 5-minute kill timeout ─────────────────────────────────
setTimeout(() => {
  logger.error('[Worker] Kill timeout reached (5 min)');
  process.exit(1);
}, 5 * 60 * 1000);

// ── Main Queue Loop ────────────────────────────────────────
async function main() {
  logger.info('[Worker] Import Worker starting...');

  const redisReady = await initRedis();
  if (!redisReady) {
    logger.error('[Worker] Cannot start: Redis unavailable');
    process.exit(1);
  }

  logger.info('[Worker] Listening on import_jobs queue...');

  let consecutiveErrors = 0;

  while (true) {
    try {
      const redis = getRedis();
      const result = await redis.blpop('import_jobs', 30);

      if (result && result.length === 2) {
        consecutiveErrors = 0;
        const [, payloadString] = result;

        let parsed: unknown;
        try {
          parsed = JSON.parse(payloadString);
        } catch {
          logger.error('[Worker] Invalid JSON payload', { raw: payloadString.slice(0, 200) });
          continue;
        }

        if (!validatePayload(parsed)) {
          logger.error('[Worker] Invalid payload', { keys: Object.keys(parsed as object).join(',') });
          continue;
        }

        logger.info(`[Worker] Processing job: ${parsed.jobId} (${parsed.type})`);
        await processJob(parsed);
      }
    } catch (error) {
      const errorStr = String(error);
      const isConnectionError = errorStr.includes('Connection') || errorStr.includes('not connected');

      if (isConnectionError) {
        logger.error('[Worker] Connection lost, attempting reconnect...');
        const reconnected = await initRedis();
        if (!reconnected) {
          logger.error('[Worker] Reconnect failed, exiting');
          process.exit(1);
        }
        consecutiveErrors = 0;
      } else {
        consecutiveErrors++;
      }

      const backoff = Math.min(5000 * Math.pow(2, consecutiveErrors - 1), 60_000);
      logger.warn(`[Worker] Error, retrying in ${Math.round(backoff / 1000)}s`, { error: errorStr, attempt: consecutiveErrors });
      await Bun.sleep(backoff);
    }
  }
}

// ── Process a Single Job ───────────────────────────────────
async function processJob(payload: WorkerJobPayload) {
  const { jobId, tempFilePath, config, userId, previewLogId } = payload;

  try {
    if (!tempFilePath) throw new Error('No temp file path provided');

    setProgress(jobId, {
      status: 'processing',
      current: 0,
      total: 0,
      message: 'Reading file...'
    });

    if (previewLogId) {
      await db
        .update(importLogs)
        .set({ status: 'processing' })
        .where(eq(importLogs.id, previewLogId));
    }

    logger.info(`[Worker] Job ${jobId}: Reading file from ${tempFilePath}`);

    try {
      await fs.stat(tempFilePath);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
        throw new Error(
          `File loss detected (ENOENT): The temporary file at ${tempFilePath} was deleted by the OS before the worker could read it.`
        );
      }
      throw err;
    }

    const startRow = config?.startRow || 2;
    const isCSV = payload.fileName.toLowerCase().endsWith('.csv');

    const allRows: string[][] = [];

    if (isCSV) {
      const text = await Bun.file(tempFilePath).text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      for (const line of lines) {
        const cells: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
              current += '"';
              i++;
            } else if (ch === '"') {
              inQuotes = false;
            } else {
              current += ch;
            }
          } else if (ch === '"') {
            inQuotes = true;
          } else if (ch === ',') {
            cells.push(current);
            current = '';
          } else {
            current += ch;
          }
        }
        cells.push(current);
        allRows.push(cells);
      }
    } else {
      const workbook = new ExcelJS.stream.xlsx.WorkbookReader(tempFilePath, {
        entries: 'emit',
        sharedStrings: 'cache'
      });

      for await (const worksheetReader of workbook) {
        for await (const row of worksheetReader) {
          const rowValues: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
            rowValues.push(
              cell.value !== null && cell.value !== undefined ? String(cell.value) : ''
            );
          });
          allRows.push(rowValues);
        }
        break;
      }
    }

    if (allRows.length === 0) {
      throw new Error('Empty sheet');
    }

    const dataStartIndex = startRow - 1;
    const totalRowsToProcess = allRows.length - dataStartIndex;

    if (totalRowsToProcess <= 0) {
      throw new Error('No data rows found (only headers)');
    }

    if (totalRowsToProcess > MAX_IMPORT_ROWS) {
      throw new Error(
        `Too many rows (${totalRowsToProcess}). Max: ${MAX_IMPORT_ROWS}. Split the file.`
      );
    }

    setProgress(jobId, {
      status: 'processing',
      current: 0,
      total: totalRowsToProcess,
      message: 'Optimizing DB lookups...'
    });

    const getRowValue = (row: string[], col: string | undefined): string | undefined => {
      if (!col) return undefined;
      const idx = colLetterToIndex(col.toUpperCase()) - 1;
      return idx >= 0 && idx < row.length && row[idx] ? row[idx] : undefined;
    };

    const uniqueIdentifiers = new Set<string>();
    for (let i = dataStartIndex; i < allRows.length; i++) {
      if (i - dataStartIndex >= MAX_IMPORT_ROWS) break;
      const row = allRows[i];
      const name = getRowValue(row, config?.mapping.name);
      const phone = getRowValue(row, config?.mapping.phone);
      const email = getRowValue(row, config?.mapping.email);
      if (phone) uniqueIdentifiers.add(String(phone).trim());
      if (email) uniqueIdentifiers.add(String(email).trim());
      if (name && !phone && !email) uniqueIdentifiers.add(String(name).trim());
    }

    const userCache = new Map<string, { id: string; phone: string | null }>();
    const identifiersArray = Array.from(uniqueIdentifiers).filter(Boolean);

    if (identifiersArray.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < identifiersArray.length; i += chunkSize) {
        const chunk = identifiersArray.slice(i, i + chunkSize);
        const foundUsers = await db
          .select()
          .from(users)
          .where(or(inArray(users.email, chunk), inArray(users.phoneNumber, chunk)));
        for (const u of foundUsers) {
          if (u.email) userCache.set(u.email, { id: u.id, phone: u.phoneNumber });
          if (u.phoneNumber) userCache.set(u.phoneNumber, { id: u.id, phone: u.phoneNumber });
        }
      }
    }

    const errors: string[] = [];
    const newDebts: Array<{
      id: string;
      debtorId: string | null;
      creditorId: string;
      debtorPhone: string;
      creditorPhone: string;
      amount: number;
      description: string;
      status: string;
      uploadedById: string;
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    let consecutiveEmpty = 0;
    let rowCount = 0;

    const creditorId = typeof userId === 'string' ? userId : userId.id;
    const creditorUser = await db.select().from(users).where(eq(users.id, creditorId)).get();
    const creditorPhone = creditorUser?.phoneNumber || '';

    logger.info(`[Worker] Job ${jobId}: Processing ${totalRowsToProcess} rows`);

    for (let i = dataStartIndex; i < allRows.length; i++) {
      rowCount++;
      const excelRow = i + 1;
      const row = allRows[i];

      if (rowCount % 100 === 0) {
        try {
          const redis = getRedis();
          const status = await redis.send('HGET', [`job:${jobId}`, 'status']).catch(() => null);
          if (status === 'cancelled') {
            logger.info(`[Worker] ${jobId} cancelled`);
            break;
          }
        } catch {
          // Ignore check error
        }
      }

      setProgress(jobId, {
        current: rowCount,
        total: totalRowsToProcess,
        status: 'processing',
        message: `Processing row ${rowCount} / ${totalRowsToProcess}...`,
        errors: errors.length > 0 ? errors.slice(-5) : undefined
      });

      if (rowCount > MAX_IMPORT_ROWS || consecutiveEmpty > 20) break;

      const name = getRowValue(row, config?.mapping.name);
      const amountRaw = getRowValue(row, config?.mapping.amount);

      if (!name && !amountRaw) {
        consecutiveEmpty++;
        continue;
      }
      consecutiveEmpty = 0;

      if (!name) {
        errors.push(`Row ${excelRow}: Missing name`);
        continue;
      }

      const amount = parseFloat(String(amountRaw || '0').replace(/[^0-9.-]/g, ''));
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Row ${excelRow}: Invalid amount`);
        continue;
      }

      const phone = getRowValue(row, config?.mapping.phone);
      const email = getRowValue(row, config?.mapping.email);
      const description = getRowValue(row, config?.mapping.description);

      const identifier = String(phone || email || name).trim();
      const debtorData = userCache.get(identifier);

      newDebts.push({
        id: randomUUIDv7('base64url'),
        debtorId: debtorData?.id || null,
        creditorId: creditorId,
        debtorPhone: phone || debtorData?.phone || name || '',
        creditorPhone: creditorPhone,
        amount,
        description: description || `Imported: ${name}`,
        status: 'pending',
        uploadedById: creditorId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    if (newDebts.length > 0) {
      await db.insert(debts).values(newDebts);
      logger.info(`[Worker] Job ${jobId}: Inserted ${newDebts.length} rows`);
    }

    await db
      .update(importLogs)
      .set({
        status: 'success',
        totalRows: allRows.length,
        importedCount: newDebts.length,
        errorCount: errors.length,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date()
      })
      .where(eq(importLogs.id, jobId));

    setProgress(jobId, {
      current: totalRowsToProcess,
      total: totalRowsToProcess,
      status: 'success',
      message: 'Import completed successfully',
      result: { imported: newDebts.length, errors: errors.length > 0 ? errors : undefined }
    });

    logger.info(`[Worker] Job ${jobId} finished successfully`);

    await fs.unlink(tempFilePath).catch(() => {});
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`[Worker] Job ${jobId} failed:`, { error: errorMessage });

    setProgress(jobId, {
      status: 'failed',
      current: 0,
      total: 0,
      errors: [errorMessage]
    });

    await db
      .update(importLogs)
      .set({ status: 'failed', errors: JSON.stringify([errorMessage]) })
      .where(eq(importLogs.id, jobId));

    if (previewLogId) {
      await db.update(importLogs).set({ status: 'failed' }).where(eq(importLogs.id, previewLogId));
    }

    if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {});
  } finally {
    lastProgressUpdate.delete(payload.jobId);
  }
}

main().catch((err) => {
  logger.error('Fatal worker error', { error: String(err) });
  process.exit(1);
});
