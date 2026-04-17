/**
 * Import Service (Class-based with Dependency Injection)
 *
 * Handles file import: preview, parsing, and debt creation.
 * Uses constructor injection for testability.
 */
import { injectable, inject } from 'tsyringe';
import { randomUUIDv7 } from 'bun';
import {
  isValidImportFile,
  ACCEPTED_IMPORT_EXTENSIONS,
  BACKEND_CONSTANTS,
  FRONTEND_CONSTANTS
} from '@repo/config';
import { importCache, isRedisAvailable } from '@plugins/redis';
import type { ImportConfig, PreviewResult, ImportResult, ProgressResult, ImportRowProcessingState, PreviewBuildResult } from '@/types';
import type { SpreadsheetService } from './spreadsheet.service';
import type { ImportLoggerService } from './import-logger.service';
import { logger } from '@repo/logger';
import type { IImportExportRepository } from '@/types/repositories';
import type { CurrentUser, ImportRow } from '@/types';

/**
 * ImportService class with dependency injection
 */
@injectable()
export class ImportService {
  constructor(
    @inject('IImportExportRepository') private readonly importRepo: IImportExportRepository,
    @inject('SpreadsheetService') private readonly spreadsheetService: SpreadsheetService,
    @inject('ImportLoggerService') private readonly importLoggerService: ImportLoggerService
  ) { }

  /**
   * Preview an import file
   */
  async previewFile(file: File, userId: string, logId?: string): Promise<PreviewResult> {
    const id: string = logId || randomUUIDv7('base64url');
    logger.info(`[ImportService] Starting previewFile for job ${id}, file: ${file.name}`);

    const invalid = await this.validatePreviewFile(file, id);
    if (invalid) {
      return invalid;
    }

    await this.initializePreviewLog(id, userId, file);

    try {
      logger.info(`[ImportService] Parsing file for job ${id}`);
      const allRows = await this.spreadsheetService.parseToRows(file);
      logger.info(`[ImportService] Parsed ${allRows.length} rows for job ${id}`);

      if (allRows.length === 0) {
        await this.importLoggerService.updateLogStatus(id, 'failed', ['Empty sheet']);
        return { success: false, error: 'Empty sheet' };
      }

      const builtPreview = this.buildPreviewData(allRows);
      await this.updatePreviewLogConfig(id, allRows.length, builtPreview);

      const result: PreviewResult = {
        success: true,
        logId: id,
        fileName: file.name,
        totalRows: allRows.length,
        columnHeaders: builtPreview.columnHeaders,
        previewData: builtPreview.previewData,
        autoMapping: builtPreview.autoMapping
      };

      await this.finalizePreviewSuccess(id, allRows.length, result);

      return result;
    } catch (err) {
      return this.handlePreviewError(id, err);
    }
  }

  private async validatePreviewFile(file: File, id: string): Promise<PreviewResult | null> {
    if (isValidImportFile(file.name)) {
      return null;
    }

    const error = `Invalid format. Accepted: ${ACCEPTED_IMPORT_EXTENSIONS.join(', ')}`;
    await this.importLoggerService.updateLogStatus(id, 'failed', [error]);
    return { success: false, error };
  }

  private async initializePreviewLog(id: string, userId: string, file: File): Promise<void> {
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
  }

  private buildPreviewData(allRows: string[][]): PreviewBuildResult {
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
    return { columnHeaders, previewData, autoMapping };
  }

  private async updatePreviewLogConfig(
    id: string,
    totalRows: number,
    builtPreview: PreviewBuildResult
  ): Promise<void> {
    await this.importRepo.updateLog(id, {
      totalRows,
      config: JSON.stringify({
        previewData: builtPreview.previewData.slice(0, 20),
        columnHeaders: builtPreview.columnHeaders,
        autoMapping: builtPreview.autoMapping
      })
    });
  }

  private async finalizePreviewSuccess(
    id: string,
    totalRows: number,
    result: PreviewResult
  ): Promise<void> {
    await this.importLoggerService.updateLogStatus(id, 'success', []);

    if (!isRedisAvailable()) {
      return;
    }

    await importCache.setProgress(id, {
      current: totalRows,
      total: totalRows,
      status: 'success',
      result
    });
  }

  private async handlePreviewError(id: string, err: unknown): Promise<PreviewResult> {
    await this.importLoggerService.updateLogStatus(id, 'failed', [String(err)]);
    return { success: false, error: String(err) };
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
    await this.initializeImportLog(id, file, config, currentUser, previewLogId);

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
      const state = this.createImportRowProcessingState(allRows.length, startRow);

      if (state.totalRowsToProcess <= 0) {
        await this.importLoggerService.updateLogStatus(id, 'failed', [
          'No data rows found (only headers)'
        ]);
        return { success: false, error: 'No data rows found' };
      }

      await this.preloadUserCache(allRows, mapping, state);
      await this.setImportStartProgress(id, state.totalRowsToProcess);
      await this.processRows(allRows, mapping, state, currentUser, id);

      await this.persistImportRows(state.newDebts);
      await this.finalizeImportSuccess(id, allRows.length, state);

      const endTime = performance.now();
      logger.info(
        `[Benchmark] Job ${id} processing took ${(endTime - startTime).toFixed(2)}ms for ${allRows.length} rows`
      );

      return { success: true, logId: id, imported: state.newDebts.length, errors: state.errors };
    } catch (err) {
      return this.handleImportError(id, previewLogId, err);
    }
  }

  private async initializeImportLog(
    id: string,
    file: File,
    config: ImportConfig,
    currentUser: CurrentUser,
    previewLogId?: string
  ): Promise<void> {
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
  }

  private createImportRowProcessingState(totalRows: number, startRow: number): ImportRowProcessingState {
    const dataStartIndex = startRow - 1;
    return {
      errors: [],
      newDebts: [],
      userCache: new Map<string, { id: string; phone: string | null }>(),
      dataStartIndex,
      totalRowsToProcess: totalRows - dataStartIndex
    };
  }

  private getRowValue(row: string[], col: string | undefined): string | undefined {
    if (!col) return undefined;
    const idx = this.spreadsheetService.colLetterToIndex(col.toUpperCase());
    return idx >= 0 && idx < row.length && row[idx] ? row[idx] : undefined;
  }

  private async preloadUserCache(
    allRows: string[][],
    mapping: ImportConfig['mapping'],
    state: ImportRowProcessingState
  ): Promise<void> {
    const uniqueIdentifiers = new Set<string>();

    for (let i = state.dataStartIndex; i < allRows.length; i++) {
      if (i - state.dataStartIndex > BACKEND_CONSTANTS.MAX_ROWS) break;
      const row = allRows[i];
      const name = this.getRowValue(row, mapping.name);
      const phone = this.getRowValue(row, mapping.phone);
      const email = this.getRowValue(row, mapping.email);
      if (phone) uniqueIdentifiers.add(String(phone).trim());
      if (email) uniqueIdentifiers.add(String(email).trim());
      if (name && !phone && !email) uniqueIdentifiers.add(String(name).trim());
    }

    const identifiersArray = Array.from(uniqueIdentifiers).filter(Boolean);
    if (identifiersArray.length === 0) {
      return;
    }

    const chunkSize = BACKEND_CONSTANTS.CHUNK_SIZE;
    for (let i = 0; i < identifiersArray.length; i += chunkSize) {
      const chunk = identifiersArray.slice(i, i + chunkSize);
      const foundUsers = await this.importRepo.findUsersByIdentifiers(chunk);
      for (const u of foundUsers) {
        if (u.email) state.userCache.set(u.email, { id: u.id, phone: u.phoneNumber });
        if (u.phoneNumber) state.userCache.set(u.phoneNumber, { id: u.id, phone: u.phoneNumber });
      }
    }
  }

  private async setImportStartProgress(id: string, totalRowsToProcess: number): Promise<void> {
    if (!isRedisAvailable()) {
      return;
    }

    await importCache.setProgress(id, {
      current: 0,
      total: totalRowsToProcess,
      status: 'processing',
      message: 'Starting import...'
    });
  }

  private async processRows(
    allRows: string[][],
    mapping: ImportConfig['mapping'],
    state: ImportRowProcessingState,
    currentUser: CurrentUser,
    id: string
  ): Promise<void> {
    let consecutiveEmpty = 0;
    let lastUpdate = Date.now();

    for (let i = state.dataStartIndex; i < allRows.length; i++) {
      const rowCount = i - state.dataStartIndex;
      const excelRow = i + 1;
      const row = allRows[i];

      const now = Date.now();
      if (now - lastUpdate > FRONTEND_CONSTANTS.TOAST_DURATION_MS && isRedisAvailable()) {
        lastUpdate = now;
        importCache
          .setProgress(id, {
            current: rowCount,
            total: state.totalRowsToProcess,
            status: 'processing',
            message: `Processing row ${rowCount} / ${state.totalRowsToProcess}...`,
            errors: state.errors.length > 0 ? state.errors.slice(-5) : undefined
          })
          .catch((err) => logger.error('[Import] Redis update failed', { error: String(err) }));
      }

      if (
        rowCount > BACKEND_CONSTANTS.MAX_ROWS ||
        consecutiveEmpty > BACKEND_CONSTANTS.MAX_EMPTY_ROWS
      ) {
        break;
      }

      const name = this.getRowValue(row, mapping.name);
      const amountRaw = this.getRowValue(row, mapping.amount);

      if (!name && !amountRaw) {
        consecutiveEmpty++;
        continue;
      }
      consecutiveEmpty = 0;

      if (!name) {
        state.errors.push(`Row ${excelRow}: Missing name`);
        continue;
      }

      const amount = parseFloat(String(amountRaw || '0').replace(/[^0-9.-]/g, ''));
      if (isNaN(amount) || amount <= 0) {
        state.errors.push(`Row ${excelRow}: Invalid amount`);
        continue;
      }

      const phone = this.getRowValue(row, mapping.phone);
      const email = this.getRowValue(row, mapping.email);
      const description = this.getRowValue(row, mapping.description);
      const debtorData = this.resolveUser(phone || email || name, state.userCache);

      state.newDebts.push({
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
  }

  private async persistImportRows(newDebts: ImportRow[]): Promise<void> {
    if (newDebts.length === 0) {
      return;
    }

    await this.importRepo.createDebtsBatch(
      newDebts as Parameters<typeof this.importRepo.createDebtsBatch>[0]
    );
  }

  private async finalizeImportSuccess(
    id: string,
    totalRows: number,
    state: ImportRowProcessingState
  ): Promise<void> {
    await this.importRepo.updateLog(id, {
      status: 'success',
      totalRows,
      importedCount: state.newDebts.length,
      errorCount: state.errors.length,
      errors: state.errors.length > 0 ? JSON.stringify(state.errors) : null,
      completedAt: new Date()
    });

    if (!isRedisAvailable()) {
      return;
    }

    await importCache.setProgress(id, {
      current: state.totalRowsToProcess,
      total: state.totalRowsToProcess,
      status: 'success',
      message: 'Import completed successfully',
      result: {
        imported: state.newDebts.length,
        errors: state.errors.length > 0 ? state.errors : undefined
      }
    });
  }

  private async handleImportError(
    id: string,
    previewLogId: string | undefined,
    err: unknown
  ): Promise<ImportResult> {
    logger.error('[ImportService] Error processing file:', { error: String(err) });
    await this.importLoggerService.updateLogStatus(id, 'failed', [String(err)]);
    if (previewLogId) {
      await this.importRepo.updateLog(previewLogId, { status: 'failed' });
    }

    return { success: false, error: String(err) };
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
      const progresses = await importCache.getProgressBatch(logIds);
      for (let i = 0; i < logIds.length; i++) {
        const id = logIds[i];
        const progress = progresses[i];
        if (progress) {
          results[id] = {
            success: true,
            status: progress.status as any,
            current: progress.current,
            total: progress.total,
            percentage: Math.round((progress.current / (progress.total || 1)) * 100),
            message: progress.message,
            errors: progress.errors,
            result: progress.result as any
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
          status: log.status as any,
          errors: log.errors ? JSON.parse(log.errors) : undefined,
          percentage: log.totalRows ? Math.round(((log.importedCount || 0) / log.totalRows) * 100) : 0,
          message: ''
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
          status: progress.status as any,
          current: progress.current,
          total: progress.total,
          percentage: Math.round((progress.current / (progress.total || 1)) * 100),
          message: progress.message,
          errors: progress.errors,
          result: progress.result as any
        };
      }
    }

    const log = await this.importRepo.getLogById(logId, userId);

    if (!log) {
      return { success: false, error: 'Import log not found', status: 'failed', current: 0, total: 0, percentage: 0 };
    }

    return {
      success: true,
      current: log.importedCount || 0,
      total: log.totalRows || 0,
      status: log.status as any,
      errors: log.errors ? JSON.parse(log.errors) : undefined,
      percentage: log.totalRows ? Math.round(((log.importedCount || 0) / log.totalRows) * 100) : 0,
      message: ''
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
      data: logs,
      pagination: {
        page,
        limit,
        total
      }
    };
  }

  private resolveUser(
    identifier: string,
    cache: Map<string, { id: string; phone: string | null }>
  ): { id: string; phone: string | null } | null {
    if (!identifier) return null;
    const trimmed = String(identifier).trim();
    if (!trimmed) return null;
    return cache.get(trimmed) || null;
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
