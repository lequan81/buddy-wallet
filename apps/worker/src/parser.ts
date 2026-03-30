import { parseCSV } from '@repo/utils';
import ExcelJS from 'exceljs';
import { logger } from '@repo/logger';
import { SHARED_CONSTANTS } from '@repo/config';

/**
 * Parses file buffer (CSV or XLSX) into a 2D array of strings.
 */
export async function parseFile(
  buffer: Buffer,
  fileName: string
): Promise<string[][]> {
  const isCSV = fileName.toLowerCase().endsWith('.csv');
  
  if (isCSV) {
    const text = buffer.toString('utf-8');
    return parseCSV(text);
  } else {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.worksheets[0];
      
      if (!worksheet) {
        throw new Error('No worksheet found in Excel file');
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
      return allRows;
    } catch (err) {
      logger.error('[Parser] Excel loading failed', { error: String(err) });
      throw new Error('Failed to parse Excel file. Ensure it is a valid .xlsx or .xls file.');
    }
  }
}

/**
 * Validates the number of rows and checks if the sheet is empty.
 */
export function validateRowCount(rows: string[][], startRow: number): number {
  if (rows.length === 0) {
    throw new Error('File appears to be empty');
  }

  const dataStartIndex = startRow - 1;
  const totalRowsToProcess = rows.length - dataStartIndex;

  if (totalRowsToProcess <= 0) {
    throw new Error('No data rows found (only headers or empty file)');
  }

  const maxRows = SHARED_CONSTANTS.IMPORT.MAX_ROWS || 10000;
  if (totalRowsToProcess > maxRows) {
    throw new Error(
      `Too many rows (${totalRowsToProcess}). Max allowed: ${maxRows}. Please split the file.`
    );
  }

  return totalRowsToProcess;
}
