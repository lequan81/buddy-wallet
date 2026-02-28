/**
 * Import Worker — Background Job Processor
 *
 * Runs as a separate Bun process: `bun run --watch src/workers/import-worker.ts`
 * Shares .env with the API since it lives under apps/api/.
 *
 * Features:
 * - Circuit breaker for Redis (trips after 3 failures, resets after 60s)
 * - Throttled progress updates (max 1/sec per job, fire-and-forget)
 * - Exponential backoff on queue errors (5s → 10s → 20s → max 60s)
 * - Typed payloads (no `any`)
 * - Payload validation before processing
 */
import { RedisClient } from 'bun';
import { logger } from '@repo/logger';
import ExcelJS from 'exceljs';
import { db, debts, users, importLogs, eq, or, inArray } from '@repo/db';
import { randomUUIDv7 } from 'bun';
import * as fs from 'node:fs/promises';
import { MAX_IMPORT_ROWS, MAX_DAILY_IMPORT_ROWS } from '@repo/config';
import type { WorkerJobPayload, ImportProgress } from '../types/worker';

// ── Redis Connection (uses Bun.env, same .env as API) ──────
const REDIS_HOST = Bun.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Bun.env.REDIS_PORT || '6379';
const REDIS_PASSWORD = Bun.env.REDIS_PASSWORD;
const REDIS_TLS = Bun.env.REDIS_TLS?.toLowerCase() === 'true';

function buildRedisUrl(): string {
  const protocol = REDIS_TLS ? 'rediss' : 'redis';
  const url = new URL(`${protocol}://${REDIS_HOST}:${REDIS_PORT}`);
  if (REDIS_PASSWORD) url.password = REDIS_PASSWORD;
  return url.toString();
}

const redis = new RedisClient(buildRedisUrl(), {
  connectionTimeout: 5000,
  autoReconnect: true,
  maxRetries: 3,
  enableOfflineQueue: true
});

// ── Circuit Breaker ────────────────────────────────────────
let redisFailures = 0;
let lastFailure = 0;
const MAX_FAILURES = 3;
const CIRCUIT_RESET_MS = 60_000;

function isRedisHealthy(): boolean {
  if (redisFailures >= MAX_FAILURES) {
    if (Date.now() - lastFailure > CIRCUIT_RESET_MS) {
      redisFailures = 0;
      logger.info('[Worker] Redis circuit breaker reset');
      return true;
    }
    return false;
  }
  return true;
}

function onRedisSuccess(): void {
  if (redisFailures > 0) redisFailures--;
}

function onRedisFailure(err: unknown): void {
  redisFailures++;
  lastFailure = Date.now();
  logger.error('[Worker] Redis operation failed', { error: String(err), failures: redisFailures });
}

// ── Throttled Progress Updates ─────────────────────────────
// Rate-limit: max 1 Redis write per second per job (fire-and-forget)
const lastProgressUpdate = new Map<string, number>();
const PROGRESS_THROTTLE_MS = 1000;

function setProgress(logId: string, progress: ImportProgress): void {
  if (!isRedisHealthy()) return;

  const now = Date.now();
  const last = lastProgressUpdate.get(logId) || 0;

  // Always send status changes (success/failed); throttle processing updates
  const isStatusChange = progress.status !== 'processing';
  if (!isStatusChange && now - last < PROGRESS_THROTTLE_MS) {
    return; // Throttled — skip non-critical update
  }
  lastProgressUpdate.set(logId, now);

  // Fire-and-forget — never await progress writes
  redis
    .send('SETEX', [`bw:import:${logId}`, '3600', JSON.stringify(progress)])
    .then(() => onRedisSuccess())
    .catch((err) => onRedisFailure(err));
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

// ── Cell Value Helper (ExcelJS) ─────────────────────────────
// ExcelJS rows are 1-indexed arrays; columns map by letter → index
const colLetterToIndex = (col: string): number => {
  const letterPart = col.includes(':') ? col.split(':')[0].toUpperCase() : col.toUpperCase();
  let idx = 0;
  for (let i = 0; i < letterPart.length; i++) {
    idx = idx * 26 + (letterPart.charCodeAt(i) - 64); // A=1, B=2, ...
  }
  return idx;
};

// ── 5-minute kill timeout for runaway jobs ──────────────────
setTimeout(
  () => {
    logger.error('[Worker] Kill timeout reached (5 min)');
    process.exit(1);
  },
  5 * 60 * 1000
);

// ── Main Queue Loop ────────────────────────────────────────
async function main() {
  logger.info('🚀 Import Worker started, listening on import_jobs queue...');

  let consecutiveErrors = 0;

  while (true) {
    try {
      // BLPOP with 30s timeout (not 0/forever — allows circuit breaker to check)
      const result = await redis.blpop('import_jobs', 30);

      if (result && result.length === 2) {
        consecutiveErrors = 0; // Reset backoff on success
        const [, payloadString] = result;

        let parsed: unknown;
        try {
          parsed = JSON.parse(payloadString);
        } catch {
          logger.error('[Worker] Invalid JSON payload', { raw: payloadString.slice(0, 200) });
          continue;
        }

        if (!validatePayload(parsed)) {
          logger.error('[Worker] Invalid payload structure', {
            keys: Object.keys(parsed as object).join(',')
          });
          continue;
        }

        logger.info(
          `🛠️ Processing job: ${parsed.jobId} (${parsed.type}) for file ${parsed.fileName}`
        );
        await processJob(parsed);
      }
      // result is null → BLPOP timed out, just loop again
    } catch (error) {
      consecutiveErrors++;
      // Exponential backoff: 5s, 10s, 20s, 40s, max 60s
      const backoff = Math.min(5000 * Math.pow(2, consecutiveErrors - 1), 60_000);
      logger.warn(`[Worker] Queue error, retrying in ${Math.round(backoff / 1000)}s`, {
        error: String(error),
        attempts: consecutiveErrors
      });
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

    // Mark log as processing
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

    // ── Parse rows (ExcelJS streaming for XLSX, native Bun for CSV) ──
    // Collect all rows into an array first for batch user resolution
    const allRows: string[][] = [];

    if (isCSV) {
      // CSV: use Bun native reader + line split (no library needed)
      const text = await Bun.file(tempFilePath).text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      for (const line of lines) {
        // Simple CSV parsing (handles quoted fields)
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
      // XLSX: ExcelJS streaming reader for memory efficiency
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
        break; // Only process first worksheet
      }
    }

    if (allRows.length === 0) {
      throw new Error('Empty sheet');
    }

    // startRow is 1-based (row 2 = skip header), allRows is 0-indexed
    const dataStartIndex = startRow - 1;
    const totalRowsToProcess = allRows.length - dataStartIndex;

    if (totalRowsToProcess <= 0) {
      throw new Error('No data rows found (only headers)');
    }

    // Row limit check
    if (totalRowsToProcess > MAX_IMPORT_ROWS) {
      throw new Error(
        `Too many rows (${totalRowsToProcess}). Max: ${MAX_IMPORT_ROWS}. Split the file.`
      );
    }

    // Daily import limit check
    const creditorIdForLimit = typeof userId === 'string' ? userId : userId.id;
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `import:daily:${creditorIdForLimit}:${today}`;
    const dailyUsedRaw = await redis.send('GET', [dailyKey]).catch(() => null);
    const dailyUsed = parseInt((dailyUsedRaw as string) || '0');
    if (dailyUsed + totalRowsToProcess > MAX_DAILY_IMPORT_ROWS) {
      throw new Error(
        `Daily import limit exceeded (${dailyUsed}/${MAX_DAILY_IMPORT_ROWS} rows used today)`
      );
    }

    setProgress(jobId, {
      status: 'processing',
      current: 0,
      total: totalRowsToProcess,
      message: 'Optimizing DB lookups...'
    });

    // ── Helper: get cell value by column letter from row array ──
    const getRowValue = (row: string[], col: string | undefined): string | undefined => {
      if (!col) return undefined;
      const idx = colLetterToIndex(col.toUpperCase()) - 1; // Convert to 0-based
      return idx >= 0 && idx < row.length && row[idx] ? row[idx] : undefined;
    };

    // ── Batch User Resolution ───────────────────────────
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

    // ── Process Rows ────────────────────────────────────
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
      const excelRow = i + 1; // 1-based for user-facing messages
      const row = allRows[i];

      // Check cancellation every 100 rows
      if (rowCount % 100 === 0) {
        const status = await redis.send('HGET', [`job:${jobId}`, 'status']).catch(() => null);
        if (status === 'cancelled') {
          logger.info(`[Worker] ${jobId} cancelled`);
          break;
        }
      }

      // Throttled progress update (fire-and-forget, max 1/sec)
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

    // ── Insert Results ──────────────────────────────────
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

    // Final progress — always sent (not throttled, status change)
    setProgress(jobId, {
      current: totalRowsToProcess,
      total: totalRowsToProcess,
      status: 'success',
      message: 'Import completed successfully',
      result: { imported: newDebts.length, errors: errors.length > 0 ? errors : undefined }
    });

    logger.info(`✅ Job ${jobId} finished successfully`);

    // Increment daily import counter
    const importCreditorId = typeof userId === 'string' ? userId : userId.id;
    const importToday = new Date().toISOString().slice(0, 10);
    const importDailyKey = `import:daily:${importCreditorId}:${importToday}`;
    redis.send('INCRBY', [importDailyKey, String(newDebts.length)]).catch(() => {});
    redis.send('EXPIRE', [importDailyKey, '86400']).catch(() => {});

    // Clean up the temp file
    await fs.unlink(tempFilePath).catch(() => {});
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`❌ Job ${jobId} failed:`, { error: errorMessage });

    // Final failure progress — always sent (status change)
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

    // Clean up on failure too
    if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {});
  } finally {
    // Clean up throttle tracking for completed job
    lastProgressUpdate.delete(payload.jobId);
  }
}

// ── Start ──────────────────────────────────────────────────
main().catch((err) => {
  logger.error('Fatal worker error', { error: String(err) });
  process.exit(1);
});
