/**
 * Import Service (Class-based with Dependency Injection)
 *
 * Handles file import: preview, parsing, and debt creation.
 * Uses constructor injection for testability.
 */
import { randomUUIDv7 } from 'bun';
import {
  isValidImportFile,
  ACCEPTED_IMPORT_EXTENSIONS,
  BACKEND_CONSTANTS,
  FRONTEND_CONSTANTS
} from '@repo/config';
import { importCache, isRedisAvailable } from '@plugins/redis';
import type { ImportConfig } from '@/types';
import type { PreviewResult, ImportResult, ProgressResult } from '@/types';
import type { SpreadsheetService } from './spreadsheet.service';
import type { ImportLoggerService } from './import-logger.service';
import { logger } from '@repo/logger';
import type { IImportExportRepository } from '@repo/types';
import type { CurrentUser, ImportRow } from '@/types';

/**
 * ImportService class with dependency injection
 */
export class ImportService {
  constructor(
    private readonly importRepo: IImportExportRepository,
    private readonly spreadsheetService: SpreadsheetService,
    private readonly importLoggerService: ImportLoggerService
  ) {}

  /**
   * Preview an import file
   */
  async previewFile(file: File, userId: string, logId?: string): Promise<PreviewResult> {
    const id: string = logId || randomUUIDv7('base64url');
    logger.info(`[ImportService] Starting previewFile for job ${id}, file: ${file.name}`);

    if (!isValidImportFile(file.name)) {
      const error = `Invalid format. Accepted: ${ACCEPTED_IMPORT_EXTENSIONS.join(', ')}`;
      await this.importLoggerService.updateLogStatus(id, 'failed', [error]);
      return { success: false, error };
    }

    logger.info(`[ImportService] Creating import log for job ${id}`);
    await this.importRepo.createLog({
      id,
      userId,
      fileName: file.name,
      fileSize: file.size,
      status: 'pending',
      previewLogId: null,
      totalRows: null,
      importedCount: null,
      errorCount: null,
      errors: null,
      config: null,
      completedAt: null
    });

    try {
      logger.info(`[ImportService] Parsing file for job ${id}`);
      const allRows = await this.spreadsheetService.parseToRows(file);
      logger.info(`[ImportService] Parsed ${allRows.length} rows for job ${id}`);

      if (allRows.length === 0) {
        await this.importLoggerService.updateLogStatus(id, 'failed', ['Empty sheet']);
        return { success: false, error: 'Empty sheet' };
      }

      // Determine column count from widest row
      const maxCols = allRows.reduce((max: number, row: string[]) => Math.max(max, row.length), 0);

      const columnHeaders: string[] = [];
      for (let c = 0; c < maxCols; c++) {
        const letter = this.spreadsheetService.indexToColLetter(c);
        const headerName = allRows[0]?.[c]?.trim() || '';
        columnHeaders.push(headerName ? `${letter}:${headerName}` : letter);
      }

      const previewData = allRows
        .slice(0, BACKEND_CONSTANTS.PREVIEW_ROWS)
        .map((row: string[]) => columnHeaders.map((_, i) => String(row[i] ?? '')));

      const autoMapping = this.spreadsheetService.detectColumnMapping(allRows[0] || [], columnHeaders);

      await this.importRepo.updateLog(id, {
        totalRows: allRows.length,
        config: JSON.stringify({
          previewData: previewData.slice(0, 20),
          columnHeaders,
          autoMapping
        })
      });

      const result = {
        success: true,
        logId: id,
        fileName: file.name,
        totalRows: allRows.length,
        columnHeaders,
        previewData,
        autoMapping
      };

      await this.importLoggerService.updateLogStatus(id, 'success', []);

      if (isRedisAvailable()) {
        await importCache.setProgress(id, {
          current: allRows.length, // Preview is "done"
          total: allRows.length,
          status: 'success',
          result
        });
      }

      return result;
    } catch (err) {
      await this.importLoggerService.updateLogStatus(id, 'failed', [String(err)]);
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
    await this.importRepo.createLog({
      id,
      userId: currentUser.id,
      fileName: file.name,
      fileSize: file.size,
      status: 'processing',
      previewLogId: previewLogId || null,
      config: JSON.stringify(config),
      totalRows: null,
      importedCount: null,
      errorCount: null,
      errors: null,
      completedAt: null
    });

    if (previewLogId) {
      await this.importRepo.updateLog(previewLogId, { status: 'processing' });
    }

    // Validate mapping: name and amount are required
    if (!mapping.name || !mapping.amount) {
      await this.importLoggerService.updateLogStatus(id, 'failed', [
        'Incomplete mapping: Name and Amount columns are required.'
      ]);
      return { success: false, error: 'Incomplete mapping: Name and Amount columns are required.' };
    }

    try {
      const allRows = await this.spreadsheetService.parseToRows(file);

      if (allRows.length === 0) {
        await this.importLoggerService.updateLogStatus(id, 'failed', ['Empty sheet']);
        return { success: false, error: 'Empty sheet' };
      }

      const startTime = performance.now();
      const errors: string[] = [];
      const newDebts: ImportRow[] = [];
      const userCache = new Map<string, { id: string; phone: string | null }>();
      const dataStartIndex = startRow - 1; // 0-based
      const totalRowsToProcess = allRows.length - dataStartIndex;

      if (totalRowsToProcess <= 0) {
        await this.importLoggerService.updateLogStatus(id, 'failed', [
          'No data rows found (only headers)'
        ]);
        return { success: false, error: 'No data rows found' };
      }

      // Helper to get value from row array by column letter
      const getRowValue = (row: string[], col: string | undefined): string | undefined => {
        if (!col) return undefined;
        const idx = this.spreadsheetService.colLetterToIndex(col.toUpperCase());
        return idx >= 0 && idx < row.length && row[idx] ? row[idx] : undefined;
      };

      // --- OPTIMIZATION: BATCH USER RESOLUTION ---
      const uniqueIdentifiers = new Set<string>();
      for (let i = dataStartIndex; i < allRows.length; i++) {
        if (i - dataStartIndex > BACKEND_CONSTANTS.MAX_ROWS) break;
        const row = allRows[i];
        const name = getRowValue(row, mapping.name);
        const phone = getRowValue(row, mapping.phone);
        const email = getRowValue(row, mapping.email);
        if (phone) uniqueIdentifiers.add(String(phone).trim());
        if (email) uniqueIdentifiers.add(String(email).trim());
        if (name && !phone && !email) uniqueIdentifiers.add(String(name).trim());
      }

      const identifiersArray = Array.from(uniqueIdentifiers).filter(Boolean);
      if (identifiersArray.length > 0) {
        // Chunk to avoid SQLite limits string size
        const chunkSize = BACKEND_CONSTANTS.CHUNK_SIZE;
        for (let i = 0; i < identifiersArray.length; i += chunkSize) {
          const chunk = identifiersArray.slice(i, i + chunkSize);
          const foundUsers = await this.importRepo.findUsersByIdentifiers(chunk);
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

      for (let i = dataStartIndex; i < allRows.length; i++) {
        const rowCount = i - dataStartIndex;
        const excelRow = i + 1; // 1-based for user-facing messages
        const row = allRows[i];

        // Throttled Redis updates (max once per second) to prevent rate limiting
        const now = Date.now();
        if (now - lastUpdate > FRONTEND_CONSTANTS.TOAST_DURATION_MS && isRedisAvailable()) {
          lastUpdate = now;
          // Fire-and-forget Redis update to avoid blocking import loop
          importCache
            .setProgress(id, {
              current: rowCount,
              total: totalRowsToProcess,
              status: 'processing',
              message: `Processing row ${rowCount} / ${totalRowsToProcess}...`,
              errors: errors.length > 0 ? errors.slice(-5) : undefined
            })
            .catch((err) => logger.error('[Import] Redis update failed', { error: String(err) }));
        }

        if (
          rowCount > BACKEND_CONSTANTS.MAX_ROWS ||
          consecutiveEmpty > BACKEND_CONSTANTS.MAX_EMPTY_ROWS
        )
          break;

        const name = getRowValue(row, mapping.name);
        const amountRaw = getRowValue(row, mapping.amount);

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

        const phone = getRowValue(row, mapping.phone);
        const email = getRowValue(row, mapping.email);
        const description = getRowValue(row, mapping.description);
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
        await this.importRepo.createDebtsBatch(newDebts as any[]);
      }

      await this.importRepo.updateLog(id, {
        status: 'success',
        totalRows: allRows.length,
        importedCount: newDebts.length,
        errorCount: errors.length,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date()
      });

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
        `[Benchmark] Job ${id} processing took ${(endTime - startTime).toFixed(2)}ms for ${allRows.length} rows`
      );

      return { success: true, logId: id, imported: newDebts.length, errors };
    } catch (err) {
      logger.error('[ImportService] Error processing file:', { error: String(err) });
      await this.importLoggerService.updateLogStatus(id, 'failed', [String(err)]);
      if (previewLogId) {
        await this.importRepo.updateLog(previewLogId, { status: 'failed' });
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
      for (const id of logIds) {
        const progress = await importCache.getProgress(id);
        if (progress) {
          results[id] = {
            success: true,
            ...progress,
            percentage: Math.round((progress.current / progress.total) * 100),
            result: progress.result as PreviewResult | ImportResult | undefined
          };
        }
      }
    }

    // 2. Fallback to DB for missing keys (older jobs)
    const missingIds = logIds.filter((id) => !results[id]);
    if (missingIds.length > 0) {
      const logs = await this.importRepo.getLogsByIds(missingIds, userId);
      for (const log of logs) {
        results[log.id] = {
          success: true,
          current: log.importedCount || 0,
          total: log.totalRows || 0,
          status: log.status,
          errors: log.errors ? JSON.parse(log.errors) : undefined,
          percentage: log.totalRows ? Math.round(((log.importedCount || 0) / log.totalRows) * 100) : 0
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
          result: progress.result as PreviewResult | ImportResult | undefined
        };
      }
    }

    const log = await this.importRepo.getLogById(logId, userId);

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
   * Get paginated import logs
   */
  async getLogs(userId: string, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const { logs, total } = await this.importRepo.getLogsPaginated(userId, limit, offset);

    return {
      success: true,
      logs: logs,
      total: total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  private async resolveUser(
    identifier: string,
    cache: Map<string, { id: string; phone: string | null }>
  ): Promise<{ id: string; phone: string | null } | null> {
    if (!identifier) return null;
    const trimmed = String(identifier).trim();
    if (!trimmed) return null;
    if (cache.has(trimmed)) return cache.get(trimmed)!;

    const foundUsers = await this.importRepo.findUsersByIdentifiers([trimmed]);
    const found = foundUsers[0];

    if (found) {
      const res = { id: found.id, phone: found.phoneNumber };
      cache.set(trimmed, res);
      return res;
    }
    return null;
  }

  /**
   * Get single import log by ID
   */
  async getLogById(id: string, userId: string) {
    const log = await this.importRepo.getLogById(id, userId);

    if (!log) return null;

    // Parse config JSON if available (contains preview data, column mapping, etc)
    let previewData: string[][] = [];
    let columnHeaders: string[] = [];
    let columnMapping: Record<string, string> = {};
    let startRow = 2;

    if (log.config) {
      try {
        const parsed = JSON.parse(log.config);
        previewData = parsed.previewData || [];
        columnHeaders = parsed.columnHeaders || [];
        columnMapping = parsed.columnMapping || {};
        startRow = parsed.startRow || 2;
      } catch {
        // Ignore parse errors
      }
    }

    return {
      ...log,
      previewData,
      columnHeaders,
      columnMapping,
      startRow,
      errors: log.errors ? JSON.parse(log.errors) : []
    };
  }
}
