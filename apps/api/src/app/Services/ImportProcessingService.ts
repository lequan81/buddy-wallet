/**
 * Import Processing Service
 *
 * Handles debt import operations: row processing and batch debt creation.
 */
import { injectable, inject } from 'tsyringe';
import { randomUUIDv7 } from 'bun';
import {
  isValidImportFile,
  BACKEND_CONSTANTS
} from '@repo/config';
import { importCache, isRedisAvailable } from '@infra/Redis';
import type { ImportConfig, ImportResult, ImportRowProcessingState, ImportRow, CurrentUser } from '@/types';
import { SpreadsheetService } from './SpreadsheetService';
import { ImportLoggerService } from './ImportLoggerService';
import { logger } from '@repo/logger';
import type { ImportRepositoryInterface } from '@/app/Repositories/Contracts';

/**
 * ImportProcessingService - Handles import debt processing operations
 */
@injectable()
export class ImportProcessingService {
  constructor(
    @inject('ImportRepositoryInterface') private readonly importRepo: ImportRepositoryInterface,
    @inject(SpreadsheetService) private readonly spreadsheetService: SpreadsheetService,
    @inject(ImportLoggerService) private readonly importLoggerService: ImportLoggerService
  ) { }

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
      return { code: 'INVALID_FILE', error: 'Invalid file format' };
    }

    const { mapping, startRow = 2 } = config;
    if (!mapping?.name || !mapping?.amount) {
      return { code: 'INVALID_MAPPING', error: 'Name and Amount columns required' };
    }

    const id: string = logId || randomUUIDv7('base64url');
    await this.initializeImportLog(id, file, config, currentUser, previewLogId);

    // Validate mapping: name and amount are required
    if (!mapping.name || !mapping.amount) {
      await this.importLoggerService.updateLogStatus(id, 'failed', [
        'Incomplete mapping: Name and Amount columns are required.'
      ]);
      return { code: 'INCOMPLETE_MAPPING', error: 'Incomplete mapping: Name and Amount columns are required.' };
    }

    try {
      const allRows = await this.spreadsheetService.parseToRows(file);

      if (allRows.length === 0) {
        await this.importLoggerService.updateLogStatus(id, 'failed', ['Empty sheet']);
        return { code: 'EMPTY_SHEET', error: 'Empty sheet' };
      }

      const startTime = performance.now();
      const state = this.createImportRowProcessingState(allRows.length, startRow);

      if (state.totalRowsToProcess <= 0) {
        await this.importLoggerService.updateLogStatus(id, 'failed', [
          'No data rows found (only headers)'
        ]);
        return { code: 'NO_DATA_ROWS', error: 'No data rows found' };
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

      return {
        data: { jobId: id, logId: id, imported: state.newDebts.length, errors: state.errors }
      };
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
      if (now - lastUpdate > BACKEND_CONSTANTS.JOBS.PROGRESS_THROTTLE_MS && isRedisAvailable()) {
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
        jobId: id,
        logId: id,
        imported: state.newDebts.length,
        errors: state.errors
      }
    });
  }

  private async handleImportError(
    id: string,
    previewLogId: string | undefined,
    err: unknown
  ): Promise<ImportResult> {
    logger.error('[ImportProcessingService] Error processing file:', { error: String(err) });
    await this.importLoggerService.updateLogStatus(id, 'failed', [String(err)]);
    if (previewLogId) {
      await this.importRepo.updateLog(previewLogId, { status: 'failed' });
    }

    return { code: 'IMPORT_FAILED', error: String(err) };
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
}
