import type { DetectedMapping } from '@/types';
import { Workbook } from 'exceljs';
import { Readable } from 'node:stream';
import { colToZeroBasedIndex, indexToColumnLetter, parseCSV } from '@repo/utils';

export class SpreadsheetService {
  /**
   * Convert 'A' or 'A:Amount' to 0-based index.
   */
  colLetterToIndex(col: string): number {
    return colToZeroBasedIndex(col);
  }

  indexToColLetter(idx: number): string {
    return indexToColumnLetter(idx);
  }

  async parseToRows(file: File): Promise<string[][]> {
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (isCSV) {
      // CSV: use shared parser for robust quote/newline handling.
      const text = await file.text();
      return parseCSV(text);
    }

    const allRows: string[][] = [];
    const workbook = new Workbook();

    // @ts-expect-error - Web Stream to Node Stream incompatibility
    const nodeStream = Readable.fromWeb(file.stream());
    await workbook.xlsx.read(nodeStream);

    const worksheet = workbook.worksheets[0];
    if (worksheet) {
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        const rowValues: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          rowValues.push(cell.value !== null && cell.value !== undefined ? String(cell.value) : '');
        });
        allRows.push(rowValues);
      });
    }

    return allRows;
  }

  detectColumnMapping(headerRow: unknown[], columnHeaders: string[]): DetectedMapping {
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
}
