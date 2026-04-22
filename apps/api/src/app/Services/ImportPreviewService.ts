/**
 * Import Preview Service
 *
 * Handles file preview operations for import: validation, parsing, and preview data generation.
 */
import { injectable, inject } from 'tsyringe';
import { randomUUIDv7 } from 'bun';
import {
  isValidImportFile,
  ACCEPTED_IMPORT_EXTENSIONS,
  BACKEND_CONSTANTS
} from '@repo/config';
import { importCache, isRedisAvailable } from '@infra/Redis';
import type { PreviewResult, PreviewBuildResult } from '@/types';
import { SpreadsheetService } from './SpreadsheetService';
import { ImportLoggerService } from './ImportLoggerService';
import { logger } from '@repo/logger';
import type { ImportRepositoryInterface } from '@/app/Repositories/Contracts';

/**
 * ImportPreviewService - Handles file preview for import operations
 */
@injectable()
export class ImportPreviewService {
  constructor(
    @inject('ImportRepositoryInterface') private readonly importRepo: ImportRepositoryInterface,
    @inject(SpreadsheetService) private readonly spreadsheetService: SpreadsheetService,
    @inject(ImportLoggerService) private readonly importLoggerService: ImportLoggerService
  ) { }

  /**
   * Preview an import file
   */
  async previewFile(file: File, userId: string, logId?: string): Promise<PreviewResult> {
    const id: string = logId || randomUUIDv7('base64url');
    logger.info(`[ImportPreviewService] Starting previewFile for job ${id}, file: ${file.name}`);

    const invalid = await this.validatePreviewFile(file, id);
    if (invalid) {
      return invalid;
    }

    await this.initializePreviewLog(id, userId, file);

    try {
      logger.info(`[ImportPreviewService] Parsing file for job ${id}`);
      const allRows = await this.spreadsheetService.parseToRows(file);
      logger.info(`[ImportPreviewService] Parsed ${allRows.length} rows for job ${id}`);

      if (allRows.length === 0) {
        await this.importLoggerService.updateLogStatus(id, 'failed', ['Empty sheet']);
        return { code: 'EMPTY_SHEET', error: 'Empty sheet' };
      }

      const builtPreview = this.buildPreviewData(allRows);
      await this.updatePreviewLogConfig(id, allRows.length, builtPreview);

      const result: PreviewResult = {
        data: {
          logId: id,
          fileName: file.name,
          totalRows: allRows.length,
          columnHeaders: builtPreview.columnHeaders,
          previewData: builtPreview.previewData,
          autoMapping: builtPreview.autoMapping
        }
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
    return { code: 'INVALID_FILE_FORMAT', error };
  }

  private async initializePreviewLog(id: string, userId: string, file: File): Promise<void> {
    logger.info(`[ImportPreviewService] Creating import log for job ${id}`);
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
    return { code: 'PREVIEW_FAILED', error: String(err) };
  }
}
