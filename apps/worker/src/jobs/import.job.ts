import { logger } from '@repo/logger';
import { db, debts, users, importLogs, eq, or, inArray } from '@repo/db';
import type { NewDebt } from '@repo/db';
import { randomUUIDv7 } from 'bun';
import { colLetterToIndex } from '@repo/utils';
import { SHARED_CONSTANTS } from '@repo/config';
import type { WorkerJobPayload, ColumnMapping } from '@repo/types';
import { setProgress, clearProgressCache, getRedis } from '../providers/redis';
import { parseFile, validateRowCount } from '../utils/parser';
import { s3Client } from '../providers/storage';

/**
 * Process a single import or preview job.
 */
export async function processImportJob(payload: WorkerJobPayload) {
  const { jobId, storageKey, config, userId, previewLogId } = payload;

  try {
    if (!storageKey) {
      throw new Error('Storage key is missing. Multi-node environments require S3 storage.');
    }

    setProgress(jobId, {
      status: 'processing',
      current: 0,
      total: 0,
      percentage: 0,
      message: 'Fetching file from storage...'
    });

    if (previewLogId) {
      await db
        .update(importLogs)
        .set({ status: 'processing' })
        .where(eq(importLogs.id, previewLogId));
    }

    // 1. Fetch from S3
    const sourceFile = s3Client.file(storageKey);
    if (!(await sourceFile.exists())) {
      throw new Error(`File not found in storage at: ${storageKey}`);
    }
    const fileBuffer = Buffer.from(await sourceFile.arrayBuffer());

    // 2. Parse File All Rows
    const parseResult = await parseFile(fileBuffer, payload.fileName);
    if (parseResult.kind === 'error') {
      throw new Error(parseResult.message);
    }
    const allRows = parseResult.rows;

    if (payload.type === 'preview') {
      setProgress(jobId, {
        status: 'processing',
        current: 50,
        total: allRows.length,
        percentage: 50,
        message: 'Detecting columns and caching data...'
      });

      const maxCols = allRows.reduce((max: number, row: string[]) => Math.max(max, row.length), 0);
      const columnHeaders: string[] = [];
      const indexToColLetter = (idx: number): string => {
        let temp = idx;
        let let_ = '';
        while (temp >= 0) {
          let_ = String.fromCharCode((temp % 26) + 65) + let_;
          temp = Math.floor(temp / 26) - 1;
        }
        return let_;
      };

      for (let c = 0; c < maxCols; c++) {
        const letter = indexToColLetter(c);
        const headerName = allRows[0]?.[c]?.trim() || '';
        columnHeaders.push(headerName ? `${letter}:${headerName}` : letter);
      }

      const autoMapping: ColumnMapping = { name: '', amount: '', phone: '', email: '', description: '', dueDate: '' };
      const headerRow = allRows[0] || [];
      headerRow.forEach((header, i) => {
        const h = String(header).toLowerCase().trim();
        const col = columnHeaders[i];

        if ((h.includes('ten') || h.includes('tên') || h.includes('name')) && !autoMapping.name)
          autoMapping.name = col;
        if ((h.includes('so no') || h.includes('số nợ') || h.includes('amount') || h.includes('tien') || h.includes('tiền')) && !autoMapping.amount)
          autoMapping.amount = col;
        if ((h.includes('phone') || h.includes('sdt') || h.includes('điện thoại')) && !autoMapping.phone)
          autoMapping.phone = col;
        if ((h.includes('email') || h.includes('mail')) && !autoMapping.email)
          autoMapping.email = col;
        if ((h.includes('ghi chu') || h.includes('ghi chú') || h.includes('note') || h.includes('desc')) && !autoMapping.description)
          autoMapping.description = col;
        if ((h.includes('han') || h.includes('hạn') || h.includes('due') || h.includes('date')) && !autoMapping.dueDate)
          autoMapping.dueDate = col;
      });

      const previewData = allRows.map((row: string[]) => columnHeaders.map((_, i) => String(row[i] ?? '')));

      // Push to Redis with 3 hour TTL
      const redis = getRedis();
      await redis.setex(
        `preview_data:${jobId}`,
        10800, // 3 hours in seconds
        JSON.stringify({ columnHeaders, previewData, autoMapping, totalRows: allRows.length })
      );

      await db
        .update(importLogs)
        .set({
          status: 'success',
          totalRows: allRows.length,
          completedAt: new Date()
        })
        .where(eq(importLogs.id, previewLogId || jobId));

      setProgress(jobId, {
        current: allRows.length,
        total: allRows.length,
        percentage: 100,
        status: 'success',
        message: 'Preview generated successfully'
      });

      return;
    }

    const startRow = config?.startRow || 2;
    const rowValidation = validateRowCount(allRows, startRow);
    if (rowValidation.kind === 'error') {
      throw new Error(rowValidation.message);
    }
    const totalRowsToProcess = rowValidation.count;

    setProgress(jobId, {
      status: 'processing',
      current: 0,
      total: totalRowsToProcess,
      percentage: 0,
      message: 'Optimizing database lookups...'
    });

    // 3. Batch User Lookups
    const dataStartIndex = startRow - 1;
    const getRowValue = (row: string[], col: string | undefined): string | undefined => {
      if (!col) return undefined;
      const idx = colLetterToIndex(col) - 1;
      return idx >= 0 && idx < row.length && row[idx] ? row[idx].trim() : undefined;
    };

    const uniqueIdentifiers = new Set<string>();
    for (let i = dataStartIndex; i < allRows.length; i++) {
      const row = allRows[i];
      const name = getRowValue(row, config?.mapping?.name);
      const phone = getRowValue(row, config?.mapping?.phone);
      const email = getRowValue(row, config?.mapping?.email);
      if (phone) uniqueIdentifiers.add(phone);
      if (email) uniqueIdentifiers.add(email);
      if (name && !phone && !email) uniqueIdentifiers.add(name);
    }

    const userCache = new Map<string, { id: string; phone: string | null }>();
    const identifiersArray = Array.from(uniqueIdentifiers).filter(Boolean);

    if (identifiersArray.length > 0) {
      const chunkSize = SHARED_CONSTANTS.IMPORT.CHUNK_SIZE || 200;
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

    // 4. Transform Rows to Debts
    const errors: string[] = [];
    const newDebts: NewDebt[] = [];
    let consecutiveEmpty = 0;
    let rowCount = 0;

    const creditorId = typeof userId === 'string' ? userId : userId.id;
    const creditorUser = await db.select().from(users).where(eq(users.id, creditorId)).get();
    const creditorPhone = creditorUser?.phoneNumber || '';

    for (let i = dataStartIndex; i < allRows.length; i++) {
      rowCount++;
      const excelRow = i + 1;
      const row = allRows[i];

      // Check for cancellation every 100 rows
      if (rowCount % 100 === 0) {
        try {
          const redis = getRedis();
          const status = await redis.send('HGET', [`bw:job:${jobId}`, 'status']);
          if (status === 'cancelled') {
            logger.info(`[Job:${jobId}] Cancelled by user`);
            return;
          }
        } catch { /* ignore cache errors */ }
      }

      setProgress(jobId, {
        current: rowCount,
        total: totalRowsToProcess,
        percentage: Math.round((rowCount / (totalRowsToProcess || 1)) * 100),
        status: 'processing',
        message: `Processing row ${rowCount} / ${totalRowsToProcess}...`,
        errors: errors.length > 0 ? errors.slice(-5) : undefined
      });

      if (rowCount > (SHARED_CONSTANTS.IMPORT.MAX_ROWS || 10000) || consecutiveEmpty > (SHARED_CONSTANTS.IMPORT.MAX_EMPTY_ROWS || 20)) break;

      const name = getRowValue(row, config?.mapping?.name);
      const amountRaw = getRowValue(row, config?.mapping?.amount);

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

      const phone = getRowValue(row, config?.mapping?.phone);
      const email = getRowValue(row, config?.mapping?.email);
      const description = getRowValue(row, config?.mapping?.description);

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

    // 5. Finalize DB Transaction
    if (newDebts.length > 0) {
      await db.insert(debts).values(newDebts);
      logger.info(`[Job:${jobId}] Successfully imported ${newDebts.length} records`);
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
      percentage: 100,
      status: 'success',
      message: 'Import completed successfully',
      result: {
        jobId: jobId,
        logId: jobId,
        imported: newDebts.length,
        errors: errors
      }
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`[Job:${jobId}] Failed: ${errorMessage}`);

    setProgress(jobId, {
      status: 'failed',
      current: 0,
      total: 0,
      percentage: 0,
      errors: [errorMessage]
    });

    await db
      .update(importLogs)
      .set({ status: 'failed', errors: JSON.stringify([errorMessage]) })
      .where(eq(importLogs.id, jobId));

    if (previewLogId) {
      await db.update(importLogs).set({ status: 'failed' }).where(eq(importLogs.id, previewLogId));
    }
  } finally {
    // 6. Cleanup S3 Cache
    if (storageKey) {
      if (payload.type !== 'preview') {
        // Only delete file if it was a full import. Previews need to keep it for the actual import!
        await s3Client.delete(storageKey).catch((error: unknown) => {
          logger.warn(`[Job:${jobId}] Failed to delete storage object`, { error: String(error) });
        });
      }
    }
    clearProgressCache(jobId);
  }
}
