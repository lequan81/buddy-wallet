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
