import { RedisClient } from 'bun';
import { UPLOAD_TMP_DIR } from '@repo/config';
import { logger } from '@repo/logger';
import * as XLSX from 'xlsx';
import { db, debts, users, importLogs, eq, or, inArray } from '@repo/db';
import { randomUUIDv7 } from 'bun';
import * as fs from 'node:fs/promises';

const redis = new RedisClient(process.env.REDIS_URL || 'redis://localhost:6379');

// Matches `bw:import:${logId}` for the API's progress polling
const setProgress = async (logId: string, progress: any) => {
  try {
    await redis.send('SETEX', [`bw:import:${logId}`, '3600', JSON.stringify(progress)]);
  } catch (err) {
    logger.error('Failed to update Redis progress', { error: String(err) });
  }
};

const getCellValue = (sheet: XLSX.WorkSheet, col: string | undefined, row: number) => {
  if (!col) return undefined;
  const cell = sheet[`${col}${row}`];
  return cell?.v !== undefined ? String(cell.v) : undefined;
};

// Start listening loop
async function main() {
  logger.info('🚀 Background Worker started, listening to import_jobs queue...');

  while (true) {
    try {
      // Block until a job arrives
      const result = await redis.blpop('import_jobs', 0);

      if (result && result.length === 2) {
        const [, payloadString] = result;
        const payload = JSON.parse(payloadString);

        logger.info(
          `🛠️ Received job: ${payload.jobId} (${payload.type}) for file ${payload.fileName}`
        );
        await processJob(payload);
      }
    } catch (error) {
      logger.error('Queue loop error', { error: String(error) });
      await Bun.sleep(5000);
    }
  }
}

async function processJob(payload: any) {
  const { jobId, tempFilePath, config, userId, previewLogId } = payload;

  try {
    if (!tempFilePath) throw new Error('No temp file path provided');

    await setProgress(jobId, {
      status: 'processing',
      current: 0,
      total: 0,
      message: 'Reading file...'
    });

    // Ensure log is marked processing
    if (previewLogId) {
      await db
        .update(importLogs)
        .set({ status: 'processing' })
        .where(eq(importLogs.id, previewLogId));
    }

    logger.info(`Job ${jobId}: Reading file from ${tempFilePath}`);
    const fileBuffer = await fs.readFile(tempFilePath);

    const options: XLSX.ParsingOptions = { type: 'buffer', codepage: 65001 };
    let workbook: XLSX.WorkBook;

    if (payload.fileName.toLowerCase().endsWith('.csv')) {
      const text = new TextDecoder('utf-8').decode(fileBuffer);
      workbook = XLSX.read(text, { type: 'string', codepage: 65001 });
    } else {
      workbook = XLSX.read(fileBuffer, options);
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet['!ref']) {
      throw new Error('Empty sheet');
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const startRow = config.startRow || 2;
    const totalRowsToProcess = range.e.r + 1 - startRow;

    await setProgress(jobId, {
      status: 'processing',
      current: 0,
      total: totalRowsToProcess,
      message: 'Optimizing DB lookups...'
    });

    // Optimization: Batch User Resolution
    const uniqueIdentifiers = new Set<string>();
    for (let r = startRow; r <= range.e.r + 1; r++) {
      if (r > 10000) break;
      const name = getCellValue(sheet, config.mapping.name, r);
      const phone = getCellValue(sheet, config.mapping.phone, r);
      const email = getCellValue(sheet, config.mapping.email, r);
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
    const newDebts: any[] = [];
    let consecutiveEmpty = 0;
    let lastUpdate = Date.now();

    const creditorId = typeof userId === 'string' ? userId : userId.id;
    const creditorUser = await db.select().from(users).where(eq(users.id, creditorId)).get();
    const creditorPhone = creditorUser?.phoneNumber || '';

    logger.info(`Job ${jobId}: Processing ${totalRowsToProcess} rows`);

    for (let excelRow = startRow; excelRow <= range.e.r + 1; excelRow++) {
      const now = Date.now();
      if (now - lastUpdate > 1000) {
        lastUpdate = now;
        setProgress(jobId, {
          current: excelRow - startRow,
          total: totalRowsToProcess,
          status: 'processing',
          message: `Processing row ${excelRow} / ${range.e.r + 1}...`,
          errors: errors.length > 0 ? errors.slice(-5) : undefined
        });
      }

      if (excelRow > 10000 || consecutiveEmpty > 20) break;

      const name = getCellValue(sheet, config.mapping.name, excelRow);
      const amountRaw = getCellValue(sheet, config.mapping.amount, excelRow);

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

      const phone = getCellValue(sheet, config.mapping.phone, excelRow);
      const email = getCellValue(sheet, config.mapping.email, excelRow);
      const description = getCellValue(sheet, config.mapping.description, excelRow);

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
      logger.info(`Job ${jobId}: Inserted ${newDebts.length} rows`);
    }

    await db
      .update(importLogs)
      .set({
        status: 'success',
        totalRows: range.e.r + 1,
        importedCount: newDebts.length,
        errorCount: errors.length,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date()
      })
      .where(eq(importLogs.id, jobId));

    await setProgress(jobId, {
      current: totalRowsToProcess,
      total: totalRowsToProcess,
      status: 'success',
      message: 'Import completed successfully',
      result: { imported: newDebts.length, errors: errors.length > 0 ? errors : undefined }
    });

    logger.info(`✅ Job ${jobId} finished successfully`);

    // Clean up the temp file
    await fs.unlink(tempFilePath).catch(() => {});
  } catch (err: any) {
    logger.error(`❌ Job ${jobId} failed:`, { error: String(err) });

    await setProgress(jobId, {
      status: 'failed',
      current: 0,
      total: 0,
      errors: [err.message]
    });
    await db
      .update(importLogs)
      .set({ status: 'failed', errors: JSON.stringify([err.message]) })
      .where(eq(importLogs.id, jobId));
    if (previewLogId) {
      await db.update(importLogs).set({ status: 'failed' }).where(eq(importLogs.id, previewLogId));
    }

    // Clean up on failure too
    if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {});
  }
}

main().catch((err) => {
  logger.error('Fatal worker error', { error: String(err) });
  process.exit(1);
});
