/**
 * Import Service (Class-based with Dependency Injection)
 *
 * Handles file import: preview, parsing, and debt creation.
 * Uses constructor injection for testability.
 */
import { randomUUIDv7 } from 'bun';
import { users, debts, importLogs, eq, or, and, lte, desc, inArray } from '@repo/db';
import { isValidImportFile, ACCEPTED_IMPORT_EXTENSIONS } from '@repo/config';
import { importCache, isRedisAvailable } from '../plugins/redis';
import type { ImportConfig } from '../types';
import type { PreviewResult, ImportResult, ProgressResult } from '../types';
import * as XLSX from 'xlsx';
import { configs } from '../configs';
import { logger } from '@repo/logger';
import type { DbClient } from '../types';

import type { CurrentUser, ImportRow, DetectedMapping } from '../types';

/**
 * ImportService class with dependency injection
 */
export class ImportService {
  constructor(private db: DbClient) {}

  /**
   * Preview an import file
   */
  async previewFile(file: File, userId: string, logId?: string): Promise<PreviewResult> {
    const id: string = logId || randomUUIDv7('base64url');

    if (!isValidImportFile(file.name)) {
      const error = `Invalid format. Accepted: ${ACCEPTED_IMPORT_EXTENSIONS.join(', ')}`;
      await this.updateLogStatus(id, 'failed', [error]);
      return { success: false, error };
    }

    await this.db.insert(importLogs).values({
      id,
      userId,
      fileName: file.name,
      fileSize: file.size,
      status: 'pending',
      createdAt: new Date()
    });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = this.parseWorkbook(file.name, arrayBuffer);

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet['!ref']) {
        await this.updateLogStatus(id, 'failed', ['Empty sheet']);
        return { success: false, error: 'Empty sheet' };
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

      const autoMapping = this.detectColumnMapping(data[0] || [], columnHeaders);

      await this.db.update(importLogs).set({ totalRows: data.length }).where(eq(importLogs.id, id));

      const result = {
        success: true,
        logId: id,
        fileName: file.name,
        totalRows: data.length,
        columnHeaders,
        previewData,
        autoMapping
      };

      await this.updateLogStatus(id, 'success', []);

      if (isRedisAvailable()) {
        await importCache.setProgress(id, {
          current: data.length, // Preview is "done"
          total: data.length,
          status: 'success',
          result
        });
      }

      return result;
    } catch (err) {
      await this.updateLogStatus(id, 'failed', [String(err)]);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Import debts from file
   */
  async importDebts(
    file: File,
    config: ImportConfig,
    currentUser: CurrentUser,
    previewLogId?: string,
    logId?: string
  ): Promise<ImportResult> {
    if (!isValidImportFile(file.name)) {
      return { success: false, error: 'Invalid file format' };
    }

    const { mapping, startRow = 2 } = config;
    if (!mapping?.name || !mapping?.amount) {
      return { success: false, error: 'Name and Amount columns required' };
    }

    const id: string = logId || randomUUIDv7('base64url');
    await this.db.insert(importLogs).values({
      id,
      userId: currentUser.id,
      fileName: file.name,
      fileSize: file.size,
      status: 'processing',
      previewLogId: previewLogId || null,
      config: JSON.stringify(config),
      createdAt: new Date()
    });

    if (previewLogId) {
      await this.db
        .update(importLogs)
        .set({ status: 'processing' })
        .where(eq(importLogs.id, previewLogId));
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = this.parseWorkbook(file.name, arrayBuffer);

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet['!ref']) {
        await this.updateLogStatus(id, 'failed', ['Empty sheet']);
        return { success: false, error: 'Empty sheet' };
      }

      const range = XLSX.utils.decode_range(sheet['!ref']);
      const startTime = performance.now();
      const errors: string[] = [];
      const newDebts: ImportRow[] = [];
      const userCache = new Map<string, { id: string; phone: string | null }>();
      const totalRowsToProcess = range.e.r + 1 - startRow;

      // --- OPTIMIZATION: BATCH USER RESOLUTION ---
      const uniqueIdentifiers = new Set<string>();
      for (let r = startRow; r <= range.e.r + 1; r++) {
        if (r > 10000) break;
        const name = this.getCellValue(sheet, mapping.name, r);
        const phone = this.getCellValue(sheet, mapping.phone, r);
        const email = this.getCellValue(sheet, mapping.email, r);
        if (phone) uniqueIdentifiers.add(String(phone).trim());
        if (email) uniqueIdentifiers.add(String(email).trim());
        if (name && !phone && !email) uniqueIdentifiers.add(String(name).trim());
      }

      const identifiersArray = Array.from(uniqueIdentifiers).filter(Boolean);
      if (identifiersArray.length > 0) {
        // Chunk to avoid SQLite limits string size
        const chunkSize = 200;
        for (let i = 0; i < identifiersArray.length; i += chunkSize) {
          const chunk = identifiersArray.slice(i, i + chunkSize);
          const foundUsers = await this.db
            .select()
            .from(users)
            .where(or(inArray(users.email, chunk), inArray(users.phoneNumber, chunk)));
          for (const u of foundUsers) {
            if (u.email) userCache.set(u.email, { id: u.id, phone: u.phoneNumber });
            if (u.phoneNumber) userCache.set(u.phoneNumber, { id: u.id, phone: u.phoneNumber });
          }
        }
      }

      if (isRedisAvailable()) {
        await importCache.setProgress(id, {
          current: 0,
          total: totalRowsToProcess,
          status: 'processing',
          message: 'Starting import...'
        });
      }

      let consecutiveEmpty = 0;
      let lastUpdate = Date.now();

      for (let excelRow = startRow; excelRow <= range.e.r + 1; excelRow++) {
        // Throttled Redis updates (max once per second) to prevent rate limiting
        const now = Date.now();
        if (now - lastUpdate > 1000 && isRedisAvailable()) {
          lastUpdate = now;
          // Fire-and-forget Redis update to avoid blocking import loop
          importCache
            .setProgress(id, {
              current: excelRow - startRow,
              total: totalRowsToProcess,
              status: 'processing',
              message: `Processing row ${excelRow} / ${range.e.r + 1}...`,
              errors: errors.length > 0 ? errors.slice(-5) : undefined
            })
            .catch((err) => logger.error('[Import] Redis update failed', { error: String(err) }));
        }

        if (excelRow > 10000 || consecutiveEmpty > 20) break;

        const name = this.getCellValue(sheet, mapping.name, excelRow);
        const amountRaw = this.getCellValue(sheet, mapping.amount, excelRow);

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

        const phone = this.getCellValue(sheet, mapping.phone, excelRow);
        const email = this.getCellValue(sheet, mapping.email, excelRow);
        const description = this.getCellValue(sheet, mapping.description, excelRow);
        const debtorData = await this.resolveUser(phone || email || name, userCache);

        newDebts.push({
          id: randomUUIDv7('base64url'),
          debtorId: debtorData?.id || null,
          creditorId: currentUser.id,
          debtorPhone: phone || debtorData?.phone || name || '',
          creditorPhone: currentUser.phoneNumber || '',
          amount,
          description: description || `Imported: ${name}`,
          status: 'pending',
          uploadedById: currentUser.id,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      if (newDebts.length > 0) {
        await this.db.insert(debts).values(newDebts);
      }

      await this.db
        .update(importLogs)
        .set({
          status: 'success',
          totalRows: range.e.r + 1,
          importedCount: newDebts.length,
          errorCount: errors.length,
          errors: errors.length > 0 ? JSON.stringify(errors) : null,
          completedAt: new Date()
        })
        .where(eq(importLogs.id, id));

      if (isRedisAvailable()) {
        await importCache.setProgress(id, {
          current: totalRowsToProcess,
          total: totalRowsToProcess,
          status: 'success',
          message: 'Import completed successfully',
          result: {
            imported: newDebts.length,
            errors: errors.length > 0 ? errors : undefined
          }
        });
      }

      const endTime = performance.now();
      logger.info(
        `[Benchmark] Job ${id} processing took ${(endTime - startTime).toFixed(2)}ms for ${range.e.r + 1} rows`
      );

      return { success: true, logId: id, imported: newDebts.length, errors };
    } catch (err) {
      logger.error('[ImportService] Error processing file:', { error: String(err) });
      await this.updateLogStatus(id, 'failed', [String(err)]);
      if (previewLogId) {
        await this.db
          .update(importLogs)
          .set({ status: 'failed' })
          .where(eq(importLogs.id, previewLogId));
      }
      return { success: false, error: String(err) };
    }
  }

  /**
   * Get progress for multiple logs (Batch)
   * Optimization to reduce HTTP/JWT overhead
   */
  async getProgressBatch(
    logIds: string[],
    userId: string
  ): Promise<Record<string, ProgressResult>> {
    const results: Record<string, ProgressResult> = {};
    if (logIds.length === 0) return results;

    // 1. Try Redis first (fastest)
    if (isRedisAvailable()) {
      // TODO: Use MGET if available in redis plugin, but for now loop is fine as it's in-memory/local network usually
      // The main overhead we want to save is HTTP/JWT, not necessarily Redis RTT (though MGET is better)
      for (const id of logIds) {
        const progress = await importCache.getProgress(id);
        if (progress) {
          results[id] = {
            success: true,
            ...progress,
            percentage: Math.round((progress.current / progress.total) * 100),
            result: progress.result
          };
        }
      }
    }

    // 2. Fallback to DB for missing keys (older jobs)
    const missingIds = logIds.filter((id) => !results[id]);
    if (missingIds.length > 0) {
      const logs = await this.db
        .select()
        .from(importLogs)
        .where(
          and(
            // Use 'inArray' if available, or 'or(eq...)'
            // Drizzle 'inArray' should be imported. Let's check imports.
            // We have { users, debts, importLogs, eq, or, and, lte }
            // We need 'inArray'. If not available, we can map to ORs
            // or(eq(id, 1), eq(id, 2)...)
            or(...missingIds.map((id) => eq(importLogs.id, id))),
            eq(importLogs.userId, userId)
          )
        );

      for (const log of logs) {
        results[log.id] = {
          success: true,
          current: log.importedCount || 0,
          total: log.totalRows || 0,
          status: log.status,
          errors: log.errors ? JSON.parse(log.errors) : undefined,
          percentage: log.totalRows
            ? Math.round(((log.importedCount || 0) / log.totalRows) * 100)
            : 0
        };
      }
    }

    return results;
  }

  /**
   * Get import progress
   */
  async getProgress(logId: string, userId: string): Promise<ProgressResult> {
    if (isRedisAvailable()) {
      const progress = await importCache.getProgress(logId);
      if (progress) {
        return {
          success: true,
          ...progress,
          percentage: Math.round((progress.current / progress.total) * 100),
          result: progress.result
        };
      }
    }

    const log = await this.db
      .select()
      .from(importLogs)
      .where(and(eq(importLogs.id, logId), eq(importLogs.userId, userId)))
      .get();

    if (!log) {
      return { success: false, error: 'Import log not found' };
    }

    return {
      success: true,
      current: log.importedCount || 0,
      total: log.totalRows || 0,
      status: log.status,
      errors: log.errors ? JSON.parse(log.errors) : undefined,
      percentage: log.totalRows ? Math.round(((log.importedCount || 0) / log.totalRows) * 100) : 0
    };
  }

  /**
   * Cleanup stale pending logs (user-specific)
   * SECURITY: Filter by userId to prevent cleaning other users' logs
   */
  async cleanupStaleLogs(userId: string): Promise<{ success: boolean }> {
    const cutoff = new Date(Date.now() - configs.IMPORT.STALE_LOG_LIFETIME);
    await this.db
      .delete(importLogs)
      .where(
        and(
          eq(importLogs.userId, userId),
          eq(importLogs.status, 'pending'),
          lte(importLogs.createdAt, cutoff)
        )
      );
    return { success: true };
  }

  /**
   * Get paginated import logs
   */
  async getLogs(userId: string, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.db
        .select()
        .from(importLogs)
        .where(eq(importLogs.userId, userId))
        .orderBy(desc(importLogs.createdAt))
        .limit(limit)
        .offset(offset),

      this.db.select({ count: importLogs.id }).from(importLogs).where(eq(importLogs.userId, userId))
    ]);

    // Since we can't easily import 'desc' without changing top imports and potentially breaking things,
    // let's try to just return them and sort in memory or accept default for now.
    // actually, typically newer logs are more important.
    // Let's check imports.
    return {
      success: true,
      logs: logs,
      total: total.length,
      page,
      limit,
      totalPages: Math.ceil(total.length / limit)
    };
  }

  // ==================== Private Helpers ====================

  private parseWorkbook(filename: string, arrayBuffer: ArrayBuffer): XLSX.WorkBook {
    // Force UTF-8 for all reads to handle Vietnamese characters correctly
    const options: XLSX.ParsingOptions = {
      type: 'array',
      codepage: 65001 // UTF-8
    };

    if (filename.toLowerCase().endsWith('.csv')) {
      // For CSV, we use TextDecoder to ensure UTF-8 before passing to XLSX
      const text = new TextDecoder('utf-8').decode(arrayBuffer);
      return XLSX.read(text, { type: 'string', codepage: 65001 });
    }

    return XLSX.read(arrayBuffer, options);
  }

  private getCellValue(
    sheet: XLSX.WorkSheet,
    col: string | undefined,
    row: number
  ): string | undefined {
    if (!col) return undefined;
    const cell = sheet[`${col}${row}`];
    return cell?.v !== undefined ? String(cell.v) : undefined;
  }

  private async resolveUser(
    identifier: string,
    cache: Map<string, { id: string; phone: string | null }>
  ): Promise<{ id: string; phone: string | null } | null> {
    if (!identifier) return null;
    const trimmed = String(identifier).trim();
    if (!trimmed) return null;
    if (cache.has(trimmed)) return cache.get(trimmed)!;

    const found = await this.db
      .select()
      .from(users)
      .where(or(eq(users.email, trimmed), eq(users.phoneNumber, trimmed)))
      .get();

    if (found) {
      const res = { id: found.id, phone: found.phoneNumber };
      cache.set(trimmed, res);
      return res;
    }
    return null;
  }

  private detectColumnMapping(headerRow: unknown[], columnHeaders: string[]): DetectedMapping {
    const autoMapping: DetectedMapping = {
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

    return autoMapping;
  }

  private async updateLogStatus(
    logId: string,
    status: 'pending' | 'processing' | 'success' | 'failed',
    errors: string[],
    result?: unknown
  ): Promise<void> {
    // Update DB
    await this.db
      .update(importLogs)
      .set({ status, errors: JSON.stringify(errors) })
      .where(eq(importLogs.id, logId));

    // Update Redis
    if (isRedisAvailable()) {
      // Get existing progress to preserve counts if not provided?
      // For simplicity, just update status/errors/result.
      // If we are "success", we set current=total (or 100%).
      // If "failed", we keep it.

      const progress: any = {
        status,
        errors,
        result
      };

      if (status === 'success') {
        // Helper: assume completed if success
        progress.current = 100;
        progress.total = 100;
      }

      // We merge with existing progress if needed, but setProgress overwrites.
      // Ideally we should get then set. But for status updates this is usually fine.
      // Wait, let's read old progress first to safe counters?
      // Actually, for preview, counters don't matter much. For import, they do.
      // Let's rely on the caller to handle counters via separate calls if needed?
      // Or just fetch-modify-set.

      const old = await importCache.getProgress(logId);
      await importCache.setProgress(logId, {
        current: old?.current || 0,
        total: old?.total || 0,
        ...progress
      });
    }
  }
}
