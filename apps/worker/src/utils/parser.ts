import { parseCSV } from '@repo/utils';
import ExcelJS from 'exceljs';
import { logger } from '@repo/logger';
import { SHARED_CONSTANTS } from '@repo/config';

export type FileParseResult =
  | { kind: 'success'; rows: string[][] }
  | { kind: 'error'; code: string; message: string };

/**
 * Parses file buffer (CSV or XLSX) into a 2D array of strings.
 */
export async function parseFile(
  buffer: Buffer,
  fileName: string
): Promise<FileParseResult> {
  const isCSV = fileName.toLowerCase().endsWith('.csv');

  if (isCSV) {
    try {
      const text = buffer.toString('utf-8');
      return { kind: 'success', rows: parseCSV(text) };
    } catch (err) {
      return {
        kind: 'error',
        code: 'CSV_PARSE_ERROR',
        message: `Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return { kind: 'error', code: 'EMPTY_WORKBOOK', message: 'No worksheet found in Excel file' };
    }

    const allRows: string[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const rowValues: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        rowValues.push(
          cell.value !== null && cell.value !== undefined ? String(cell.value) : ''
        );
      });
      allRows.push(rowValues);
    });
    return { kind: 'success', rows: allRows };
  } catch (err) {
    logger.error('[Parser] Excel loading failed', { error: String(err) });
    return {
      kind: 'error',
      code: 'EXCEL_PARSE_ERROR',
      message: 'Failed to parse Excel file. Ensure it is a valid .xlsx or .xls file.'
    };
  }
}

/**
 * Validates the number of rows and checks if the sheet is empty.
 */
export function validateRowCount(rows: string[][], startRow: number): { kind: 'success'; count: number } | { kind: 'error'; message: string } {
  if (rows.length === 0) {
    return { kind: 'error', message: 'File appears to be empty' };
  }

  const dataStartIndex = startRow - 1;
  const totalRowsToProcess = rows.length - dataStartIndex;

  if (totalRowsToProcess <= 0) {
    return { kind: 'error', message: 'No data rows found (only headers or empty file)' };
  }

  const maxRows = SHARED_CONSTANTS.IMPORT.MAX_ROWS || 10000;
  if (totalRowsToProcess > maxRows) {
    return {
      kind: 'error',
      message: `Too many rows (${totalRowsToProcess}). Max allowed: ${maxRows}. Please split the file.`
    };
  }

  return { kind: 'success', count: totalRowsToProcess };
}
