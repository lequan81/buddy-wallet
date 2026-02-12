/**
 * Import Service (Class-based with Dependency Injection)
 *
 * Handles file import: preview, parsing, and debt creation.
 * Uses constructor injection for testability.
 */
import { randomUUIDv7 } from 'bun';
import { users, debts, importLogs, eq, or, and, lte } from '@repo/db';
import { isValidImportFile, ACCEPTED_IMPORT_EXTENSIONS } from '@repo/config';
import { importCache, isRedisAvailable } from '../plugins/redis';
import type { ColumnMapping, ImportConfig } from '../types';
import type { PreviewResult, ImportResult, ProgressResult } from '../types';
import * as XLSX from 'xlsx';
import { configs } from '../configs';
import type { DbClient } from '../types';

interface CurrentUser {
  id: string;
  phoneNumber: string | null;
}

/**
 * ImportService class with dependency injection
 */
export class ImportService {
  constructor(private db: DbClient) { }

  /**
   * Preview an import file
   */
  async previewFile(file: File, userId: string): Promise<PreviewResult> {
    if (!isValidImportFile(file.name)) {
      return {
        success: false,
        error: `Invalid format. Accepted: ${ACCEPTED_IMPORT_EXTENSIONS.join(', ')}`
      };
    }

    const logId = randomUUIDv7('base64url');
    await this.db.insert(importLogs).values({
      id: logId,
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
        await this.updateLogStatus(logId, 'failed', ['Empty sheet']);
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

      await this.db
        .update(importLogs)
        .set({ totalRows: data.length })
        .where(eq(importLogs.id, logId));

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
      await this.updateLogStatus(logId, 'failed', [String(err)]);
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
    previewLogId?: string
  ): Promise<ImportResult> {
    if (!isValidImportFile(file.name)) {
      return { success: false, error: 'Invalid file format' };
    }

    const { mapping, startRow = 2 } = config;
    if (!mapping?.name || !mapping?.amount) {
      return { success: false, error: 'Name and Amount columns required' };
    }

    const logId = randomUUIDv7('base64url');
    await this.db.insert(importLogs).values({
      id: logId,
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
        await this.updateLogStatus(logId, 'failed', ['Empty sheet']);
        return { success: false, error: 'Empty sheet' };
      }

      const range = XLSX.utils.decode_range(sheet['!ref']);
      const errors: string[] = [];
      const newDebts: any[] = [];
      const userCache = new Map<string, { id: string; phone: string | null }>();
      const totalRowsToProcess = range.e.r + 1 - startRow;

      if (isRedisAvailable()) {
        await importCache.setProgress(logId, {
          current: 0,
          total: totalRowsToProcess,
          status: 'processing'
        });
      }

      let consecutiveEmpty = 0;

      for (let excelRow = startRow; excelRow <= range.e.r + 1; excelRow++) {
        if (excelRow % 10 === 0 && isRedisAvailable()) {
          await importCache.setProgress(logId, {
            current: excelRow - startRow,
            total: totalRowsToProcess,
            status: 'processing',
            errors: errors.length > 0 ? errors.slice(-5) : undefined
          });
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
          debtorPhone: phone || debtorData?.phone || name,
          creditorPhone: currentUser.phoneNumber || null,
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
        .where(eq(importLogs.id, logId));

      if (isRedisAvailable()) {
        await importCache.setProgress(logId, {
          current: totalRowsToProcess,
          total: totalRowsToProcess,
          status: 'success',
          errors: errors.length > 0 ? errors : undefined
        });
      }

      return { success: true, logId, imported: newDebts.length, errors };
    } catch (err) {
      await this.updateLogStatus(logId, 'failed', [String(err)]);
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
   * Get import progress
   */
  async getProgress(logId: string, userId: string): Promise<ProgressResult> {
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

  // ==================== Private Helpers ====================

  private parseWorkbook(filename: string, arrayBuffer: ArrayBuffer): XLSX.WorkBook {
    if (filename.toLowerCase().endsWith('.csv')) {
      const text = new TextDecoder().decode(arrayBuffer);
      return XLSX.read(text, { type: 'string' });
    }
    return XLSX.read(arrayBuffer);
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

  private detectColumnMapping(headerRow: any[], columnHeaders: string[]): Record<string, string> {
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

    return autoMapping;
  }

  private async updateLogStatus(
    logId: string,
    status: 'pending' | 'processing' | 'success' | 'failed',
    errors: string[]
  ): Promise<void> {
    await this.db
      .update(importLogs)
      .set({ status, errors: JSON.stringify(errors) })
      .where(eq(importLogs.id, logId));
  }
}
