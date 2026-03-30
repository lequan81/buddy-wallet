import type { DetectedMapping } from '@/types';
import { Workbook } from 'exceljs';
import { Readable } from 'node:stream';

export class SpreadsheetService {
  /**
   * Convert 'A' or 'A:Amount' to 0-based index.
   */
  colLetterToIndex(col: string): number {
    const letterPart = col.includes(':') ? col.split(':')[0].toUpperCase() : col.toUpperCase();
    let idx = 0;
    for (let i = 0; i < letterPart.length; i++) {
      idx = idx * 26 + (letterPart.charCodeAt(i) - 64);
    }
    return idx - 1;
  }

  indexToColLetter(idx: number): string {
    let result = '';
    let n = idx;
    while (n >= 0) {
      result = String.fromCharCode((n % 26) + 65) + result;
      n = Math.floor(n / 26) - 1;
    }
    return result;
  }

  async parseToRows(file: File): Promise<string[][]> {
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (isCSV) {
      // CSV: use file.text() for native string extraction mapping
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      return lines.map((line) => {
        const cells: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
              current += '"';
              i++;
            } else if (ch === '"') {
              inQuotes = false;
            } else {
              current += ch;
            }
          } else if (ch === '"') {
            inQuotes = true;
          } else if (ch === ',') {
            cells.push(current);
            current = '';
          } else {
            current += ch;
          }
        }
        cells.push(current);
        return cells;
      });
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
