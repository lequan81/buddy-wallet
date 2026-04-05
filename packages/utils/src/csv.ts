/**
 * Robust CSV parser that handles multiline cells and escaped quotes.
 * Adheres to RFC 4180 principles while being lightweight.
 * 
 * Logic: Single-pass character scanner to handle newlines and commas inside quotes.
 * 
 * @param text The raw CSV string
 * @returns 2D array of strings representing rows and cells
 */
export function parseCSV(text: string): string[][] {
  if (!text) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentCell += '"';
        i++; 
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes) {
      if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
        continue;
      }
      if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        continue;
      }
    }

    currentCell += char;
  }

  if (currentRow.length > 0 || currentCell !== '') {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter(row => row.some(cell => cell.trim().length > 0));
}

/**
 * Convert spreadsheet column label to 0-based index.
 * Supports labels like "A", "AA", and "A:Amount".
 */
export function colToZeroBasedIndex(col: string): number {
  const letterPart = col.includes(':') ? col.split(':')[0].toUpperCase() : col.toUpperCase();
  let idx = 0;
  for (let i = 0; i < letterPart.length; i++) {
    idx = idx * 26 + (letterPart.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/**
 * Convert 0-based index to spreadsheet column label.
 */
export function indexToColumnLetter(idx: number): string {
  let result = '';
  let n = idx;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Escape a CSV cell using RFC-4180 style quotes.
 */
export function escapeCSVCell(value: unknown): string {
  const normalized = String(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
}

/**
 * Build a CSV string from tabular object rows.
 */
export function buildCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  const keys = Object.keys(rows[0]);
  const header = keys.map((key) => escapeCSVCell(key)).join(',');
  const body = rows.map((row) => keys.map((key) => escapeCSVCell(row[key])).join(','));

  return [header, ...body].join('\n');
}
