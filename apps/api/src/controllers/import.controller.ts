import { randomUUIDv7 } from 'bun';
import { Elysia, t } from 'elysia';
import { db, users, debts, importLogs, eq, or, and, lte, type User } from '@repo/db';
import { BE_ERRORS, GEN_ERRORS, createError } from '@repo/errors';
import { isValidImportFile, ACCEPTED_IMPORT_EXTENSIONS, MAX_IMPORT_ROWS } from '@repo/config';
import { accessControlPlugin } from '@plugins/access-control';
import { cache, importCache, isRedisAvailable } from '@plugins/redis';
import type { ColumnMapping, ImportConfig } from '@/types';
import * as XLSX from 'xlsx';
import { configs } from '../configs';

export const importController = new Elysia({ prefix: '/import' })
  .use(accessControlPlugin)
  // User comes from sessionAuthPlugin at parent level
  .onBeforeHandle((ctx) => {
    const { user, set } = ctx as typeof ctx & { user: User | null };
    if (!user) {
      set.status = 401;
      return createError(GEN_ERRORS.UNAUTHORIZED, 'Authentication required');
    }
  })

  // Preview endpoint
  .post(
    '/preview',
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & { user: User };
      const { file } = body;

      // Validate file extension
      if (!isValidImportFile(file.name)) {
        set.status = 400;
        return createError(
          BE_ERRORS.IMPORT_INVALID_FORMAT,
          `Accepted formats: ${ACCEPTED_IMPORT_EXTENSIONS.join(', ')}`
        );
      }

      // Log the preview request
      const logId = randomUUIDv7('base64url');
      await db.insert(importLogs).values({
        id: logId,
        userId: user!.id,
        fileName: file.name,
        fileSize: file.size,
        status: 'pending',
        createdAt: new Date()
      });

      try {
        const arrayBuffer = await file.arrayBuffer();
        let workbook: XLSX.WorkBook;

        // Parse based on file type
        if (file.name.toLowerCase().endsWith('.csv')) {
          const text = new TextDecoder().decode(arrayBuffer);
          workbook = XLSX.read(text, { type: 'string' });
        } else {
          workbook = XLSX.read(arrayBuffer);
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        if (!sheet['!ref']) {
          await db
            .update(importLogs)
            .set({
              status: 'failed',
              errors: JSON.stringify([BE_ERRORS.IMPORT_EMPTY_SHEET.message])
            })
            .where(eq(importLogs.id, logId));
          set.status = 400;
          return createError(BE_ERRORS.IMPORT_EMPTY_SHEET);
        }

        const data: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const range = XLSX.utils.decode_range(sheet['!ref']);

        const columnHeaders: string[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          columnHeaders.push(XLSX.utils.encode_col(c));
        }

        const previewData = data
          .slice(0, 5)
          .map((row) => columnHeaders.map((_, i) => String(row[i] ?? '')));

        // Auto-detect mappings
        const headerRow = data[0] || [];
        const autoMapping: Record<string, string> = {
          name: '',
          amount: '',
          phone: '',
          email: '',
          description: '',
          dueDate: ''
        };

        headerRow.forEach((header, i) => {
          const h = String(header).toLowerCase().trim();
          const col = columnHeaders[i];

          if ((h.includes('ten') || h.includes('tên') || h.includes('name')) && !autoMapping.name)
            autoMapping.name = col;
          if (
            (h.includes('so no') ||
              h.includes('số nợ') ||
              h.includes('amount') ||
              h.includes('tien') ||
              h.includes('tiền')) &&
            !autoMapping.amount
          )
            autoMapping.amount = col;
          if (
            (h.includes('phone') || h.includes('sdt') || h.includes('điện thoại')) &&
            !autoMapping.phone
          )
            autoMapping.phone = col;
          if ((h.includes('email') || h.includes('mail')) && !autoMapping.email)
            autoMapping.email = col;
          if (
            (h.includes('ghi chu') ||
              h.includes('ghi chú') ||
              h.includes('note') ||
              h.includes('desc')) &&
            !autoMapping.description
          )
            autoMapping.description = col;
          if (
            (h.includes('han') || h.includes('hạn') || h.includes('due') || h.includes('date')) &&
            !autoMapping.dueDate
          )
            autoMapping.dueDate = col;
        });

        await db.update(importLogs).set({ totalRows: data.length }).where(eq(importLogs.id, logId));

        console.log(`[Import] Preview: ${file.name}, ${data.length} rows`);

        return {
          success: true,
          logId,
          fileName: file.name,
          totalRows: data.length,
          columnHeaders,
          previewData,
          autoMapping
        };
      } catch (err) {
        console.error('[Import] Preview error:', err);
        await db
          .update(importLogs)
          .set({
            status: 'failed',
            errors: JSON.stringify([String(err)])
          })
          .where(eq(importLogs.id, logId));
        set.status = 400;
        return createError(BE_ERRORS.IMPORT_PARSE_ERROR, String(err));
      }
    },
    { body: t.Object({ file: t.File() }) }
  )

  // Import endpoint
  .post(
    '/debts',
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & { user: User };
      const { file, config: configRaw, previewLogId } = body;

      if (!isValidImportFile(file.name)) {
        set.status = 400;
        return createError(BE_ERRORS.IMPORT_INVALID_FORMAT);
      }

      let config: ImportConfig;
      try {
        config = JSON.parse(configRaw);
      } catch {
        set.status = 400;
        return createError(BE_ERRORS.IMPORT_PARSE_ERROR, 'Invalid config format');
      }

      const { mapping, startRow = 2 } = config;

      if (!mapping?.name || !mapping?.amount) {
        set.status = 400;
        return createError(BE_ERRORS.IMPORT_PARSE_ERROR, 'Name and Amount columns required');
      }

      const logId = randomUUIDv7('base64url');
      await db.insert(importLogs).values({
        id: logId,
        userId: user!.id,
        fileName: file.name,
        fileSize: file.size,
        status: 'processing',
        previewLogId: previewLogId || null,
        config: configRaw,
        createdAt: new Date()
      });

      // Mark the preview log as linked (if provided)
      if (previewLogId) {
        await db
          .update(importLogs)
          .set({ status: 'processing' })
          .where(eq(importLogs.id, previewLogId));
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        let workbook: XLSX.WorkBook;

        if (file.name.toLowerCase().endsWith('.csv')) {
          const text = new TextDecoder().decode(arrayBuffer);
          workbook = XLSX.read(text, { type: 'string' });
        } else {
          workbook = XLSX.read(arrayBuffer);
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        if (!sheet['!ref']) {
          await db
            .update(importLogs)
            .set({ status: 'failed', errors: JSON.stringify(['Empty sheet']) })
            .where(eq(importLogs.id, logId));
          set.status = 400;
          return createError(BE_ERRORS.IMPORT_EMPTY_SHEET);
        }

        const range = XLSX.utils.decode_range(sheet['!ref']);
        const errors: string[] = [];
        const newDebts: any[] = [];
        const userCache = new Map<string, { id: string; phone: string | null }>();

        const resolveUser = async (identifier: string) => {
          if (!identifier) return null;
          const trimmed = String(identifier).trim();
          if (!trimmed) return null;
          if (userCache.has(trimmed)) return userCache.get(trimmed);

          const found = await db
            .select()
            .from(users)
            .where(or(eq(users.email, trimmed), eq(users.phoneNumber, trimmed)))
            .get();

          if (found) {
            const res = { id: found.id, phone: found.phoneNumber };
            userCache.set(trimmed, res);
            return res;
          }
          return null;
        };

        const getCellValue = (col: string | undefined, row: number): string | undefined => {
          if (!col) return undefined;
          const cell = sheet[`${col}${row}`];
          return cell?.v !== undefined ? String(cell.v) : undefined;
        };

        let consecutiveEmpty = 0;
        const totalRowsToProcess = range.e.r + 1 - startRow;

        // Initialize progress in Redis
        if (isRedisAvailable()) {
          await importCache.setProgress(logId, {
            current: 0,
            total: totalRowsToProcess,
            status: 'processing'
          });
        }

        for (let excelRow = startRow; excelRow <= range.e.r + 21; excelRow++) {
          if (excelRow % 10 === 0) {
            console.log(`[Import] Processing row ${excelRow}...`);
            // Update progress every 10 rows
            if (isRedisAvailable()) {
              await importCache.setProgress(logId, {
                current: excelRow - startRow,
                total: totalRowsToProcess,
                status: 'processing',
                errors: errors.length > 0 ? errors.slice(-5) : undefined // Last 5 errors
              });
            }
          }
          if (excelRow > 10000 || consecutiveEmpty > 20) break;

          const name = getCellValue(mapping.name, excelRow);
          const amountRaw = getCellValue(mapping.amount, excelRow);

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

          const phone = getCellValue(mapping.phone, excelRow);
          const email = getCellValue(mapping.email, excelRow);
          const description = getCellValue(mapping.description, excelRow);
          const debtorData = await resolveUser(phone || email || name);

          newDebts.push({
            id: randomUUIDv7('base64url'),
            debtorId: debtorData?.id || null,
            creditorId: user!.id,
            debtorPhone: phone || debtorData?.phone || name,
            creditorPhone: user!.phoneNumber || null,
            amount,
            description: description || `Imported: ${name}`,
            status: 'pending',
            uploadedById: user!.id,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        if (newDebts.length > 0) await db.insert(debts).values(newDebts);

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
          .where(eq(importLogs.id, logId));

        // Update final progress in Redis
        if (isRedisAvailable()) {
          await importCache.setProgress(logId, {
            current: totalRowsToProcess,
            total: totalRowsToProcess,
            status: 'success',
            errors: errors.length > 0 ? errors : undefined
          });
        }

        console.log(`[Import] Done: ${newDebts.length} records, ${errors.length} errors`);

        return { success: true, logId, imported: newDebts.length, errors };
      } catch (err) {
        console.error('[Import] Error:', err);
        await db
          .update(importLogs)
          .set({ status: 'failed', errors: JSON.stringify([String(err)]), completedAt: new Date() })
          .where(eq(importLogs.id, logId));

        // Also mark preview log as failed if linked
        if (previewLogId) {
          await db
            .update(importLogs)
            .set({ status: 'failed' })
            .where(eq(importLogs.id, previewLogId));
        }

        set.status = 500;
        return createError(BE_ERRORS.IMPORT_PARSE_ERROR, String(err));
      }
    },
    { body: t.Object({ file: t.File(), config: t.String(), previewLogId: t.Optional(t.String()) }) }
  )

  // Cleanup stale pending logs (older than 24 hours)
  .delete('/cleanup', async (ctx) => {
    const { user } = ctx as typeof ctx & { user: User };
    const oneDayAgo = new Date(Date.now() - configs.IMPORT.STALE_LOG_LIFETIME);

    const result = await db
      .delete(importLogs)
      .where(and(eq(importLogs.status, 'pending'), lte(importLogs.createdAt, oneDayAgo)));

    console.log(`[Import] Cleaned up stale pending logs older than 24h`);

    return { success: true, message: 'Stale pending logs cleaned up' };
  })

  // Get import progress (real-time via Redis)
  .get(
    '/progress/:logId',
    async (ctx) => {
      const {
        params: { logId },
        set,
        user
      } = ctx as typeof ctx & { user: User };

      // Try Redis first for real-time progress
      if (isRedisAvailable()) {
        const progress = await importCache.getProgress(logId);
        if (progress) {
          return {
            success: true,
            ...progress,
            percentage: Math.round((progress.current / progress.total) * 100)
          };
        }
      }

      // Fallback to database
      const log = await db
        .select()
        .from(importLogs)
        .where(and(eq(importLogs.id, logId), eq(importLogs.userId, user.id)))
        .get();

      if (!log) {
        set.status = 404;
        return { success: false, message: 'Import log not found' };
      }

      return {
        success: true,
        current: log.importedCount || 0,
        total: log.totalRows || 0,
        status: log.status,
        errors: log.errors ? JSON.parse(log.errors) : undefined,
        percentage: log.totalRows ? Math.round(((log.importedCount || 0) / log.totalRows) * 100) : 0
      };
    },
    {
      params: t.Object({
        logId: t.String()
      })
    }
  );
