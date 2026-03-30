import { describe, expect, it } from 'bun:test';
import { parseCSV } from '../src/csv';

describe('CSV Parser', () => {
  it('should parse simple CSV', () => {
    const csv = 'ID,Name,Amount\n1,Lequan,100';
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      ['ID', 'Name', 'Amount'],
      ['1', 'Lequan', '100']
    ]);
  });

  it('should handle quoted cells with commas', () => {
    const csv = '1,"Lequan, Le",100';
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      ['1', 'Lequan, Le', '100']
    ]);
  });

  it('should handle multiline cells', () => {
    const csv = 'ID,Name,Note\n1,Lequan,"Multi-line\nNote content"';
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      ['ID', 'Name', 'Note'],
      ['1', 'Lequan', 'Multi-line\nNote content']
    ]);
  });

  it('should handle escaped quotes', () => {
    const csv = '1,"Lequan ""The Developer"" Le",100';
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      ['1', 'Lequan "The Developer" Le', '100']
    ]);
  });

  it('should handle various line endings', () => {
    const csv = '1,A,10\r\n2,B,20\n3,C,30';
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      ['1', 'A', '10'],
      ['2', 'B', '20'],
      ['3', 'C', '30']
    ]);
  });
});
