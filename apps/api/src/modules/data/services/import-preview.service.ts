/**
 * Import Preview Service — Pure Functions
 * @logicType backend
 *
 * Handles Excel/CSV file parsing, column mapping suggestions,
 * and data validation for the import preview flow.
 *
 * Following ElysiaJS functional programming principles:
 * - Pure functions only (no DI, no Elysia context)
 * - Input -> Process -> Output
 * - No side effects in service layer
 */

import ExcelJS from 'exceljs';
import { normalizePhoneNumber } from '@repo/utils';
import type {
  ValidationResult,
  ColumnMapping,
  ParseResult
} from '../types/handler.types';

// === Column Mapping Aliases ===

/**
 * Common header name aliases for debt fields.
 * Maps normalized (lowercase, trimmed) header names to DB field keys.
 */
const HEADER_ALIASES: Record<string, string> = {
  // Debtor phone
  'debtorphone': 'debtorPhone',
  'debtor_phone': 'debtorPhone',
  'debtor phone': 'debtorPhone',
  'số điện thoại người nợ': 'debtorPhone',
  'sdt người nợ': 'debtorPhone',
  'phone debtor': 'debtorPhone',
  'debtor': 'debtorPhone',
  'người nợ': 'debtorPhone',

  // Creditor phone
  'creditorphone': 'creditorPhone',
  'creditor_phone': 'creditorPhone',
  'creditor phone': 'creditorPhone',
  'số điện thoại chủ nợ': 'creditorPhone',
  'sdt chủ nợ': 'creditorPhone',
  'phone creditor': 'creditorPhone',
  'creditor': 'creditorPhone',
  'chủ nợ': 'creditorPhone',

  // Amount
  'amount': 'amount',
  'số tiền': 'amount',
  'tien': 'amount',
  'tiền': 'amount',
  'total': 'amount',
  'totalamount': 'amount',
  'total_amount': 'amount',
  'gia tri': 'amount',
  'giá trị': 'amount',

  // Currency
  'currency': 'currency',
  'tiền tệ': 'currency',
  'loại tiền': 'currency',

  // Description
  'description': 'description',
  'mô tả': 'description',
  'note': 'description',
  'notes': 'description',
  'ghi chú': 'description',
  'content': 'description',
  'nội dung': 'description',

  // Due date
  'duedate': 'dueDate',
  'due_date': 'dueDate',
  'due date': 'dueDate',
  'ngày đáo hạn': 'dueDate',
  'han thanh toan': 'dueDate',
  'hạn thanh toán': 'dueDate',
  'expiry': 'dueDate',
  'expiration': 'dueDate',
  'deadline': 'dueDate',
};

// === Core Functions ===

/**
 * Parse an Excel/CSV file buffer into structured data.
 * Supports .xlsx, .xls, and .csv formats.
 */
export async function parseSpreadsheetFile(
  buffer: Buffer,
  fileName: string
): Promise<ParseResult> {
  try {
    const workbook = new ExcelJS.Workbook();

    // Detect format from file extension
    const ext = fileName.toLowerCase().split('.').pop();

    if (ext === 'csv') {
      // For CSV, parse line by line into worksheet
      const csvContent = buffer.toString('utf-8');
      const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const worksheet = workbook.addWorksheet('Sheet 1');
      for (const line of lines) {
        // Simple CSV parsing — handles basic comma separation
        const cells = line.split(',').map((cell) => cell.trim().replace(/^["']|["']$/g, ''));
        worksheet.addRow(cells);
      }
    } else {
      // xlsx or xls — use ArrayBuffer for Bun compatibility
      await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount === 0) {
      return { kind: 'success', data: { headers: [], rows: [], totalRows: 0, fileName } };
    }

    // Extract headers from first row
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim();
    });

    // Filter out empty headers
    const validHeaders = headers.filter((h) => h.length > 0);

    // Extract data rows
    const rows: Record<string, unknown>[] = [];
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowData: Record<string, unknown> = {};
      let hasValue = false;

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const headerIndex = colNumber - 1;
        if (headerIndex < validHeaders.length) {
          const value = cell.value;
          if (value !== null && value !== undefined && value !== '') {
            rowData[validHeaders[headerIndex]] = value;
            hasValue = true;
          }
        }
      });

      if (hasValue) {
        rows.push(rowData);
      }
    }

    return {
      kind: 'success',
      data: { headers: validHeaders, rows, totalRows: rows.length, fileName }
    };
  } catch (err) {
    return {
      kind: 'error',
      code: 'PARSE_ERROR',
      message: `Failed to parse ${fileName}: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Suggest column mapping based on header names.
 * Uses fuzzy matching against known aliases.
 */
export function suggestColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    const dbField = HEADER_ALIASES[normalized];

    if (dbField && !mapping[dbField]) {
      mapping[dbField] = header;
    }
  }

  return mapping;
}

/**
 * Apply column mapping to transform raw rows into debt-shaped objects.
 */
export function applyColumnMapping(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
  startRow: number = 1
): Record<string, unknown>[] {
  // Reverse mapping: spreadsheet header -> db field
  const reverseMapping: Record<string, string> = {};
  for (const [dbField, header] of Object.entries(mapping)) {
    if (header) {
      reverseMapping[header] = dbField;
    }
  }

  const mappedRows: Record<string, unknown>[] = [];

  // Skip rows before startRow (1-indexed, skip header)
  const dataRows = rows.slice(startRow - 1);

  for (const row of dataRows) {
    const mappedRow: Record<string, unknown> = {};

    for (const [header, value] of Object.entries(row)) {
      const dbField = reverseMapping[header];
      if (dbField && value !== null && value !== undefined && value !== '') {
        mappedRow[dbField] = value;
      }
    }

    // Only include rows that have at least one mapped field
    if (Object.keys(mappedRow).length > 0) {
      mappedRows.push(mappedRow);
    }
  }

  return mappedRows;
}

/**
 * Validate mapped debt rows.
 * Returns validation result with errors for invalid rows.
 */
export function validateMappedRows(rows: Record<string, unknown>[]): ValidationResult {
  const errors: string[] = [];
  let validRowCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Must have at least debtorPhone or creditorPhone
    if (!row.debtorPhone && !row.creditorPhone) {
      errors.push(`Row ${rowNum}: Missing both debtorPhone and creditorPhone`);
      continue;
    }

    // Must have amount
    if (!row.amount) {
      errors.push(`Row ${rowNum}: Missing amount`);
      continue;
    }

    // Validate amount is a positive number
    const amount = typeof row.amount === 'string' ? parseFloat(row.amount) : Number(row.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push(`Row ${rowNum}: Invalid amount (${row.amount})`);
      continue;
    }

    // Normalize phone numbers if present
    if (row.debtorPhone) {
      const normalized = normalizePhoneNumber(String(row.debtorPhone));
      if (normalized) row.debtorPhone = normalized;
    }
    if (row.creditorPhone) {
      const normalized = normalizePhoneNumber(String(row.creditorPhone));
      if (normalized) row.creditorPhone = normalized;
    }

    // Normalize amount to number
    row.amount = amount;

    // Normalize currency
    if (row.currency) {
      row.currency = String(row.currency).toUpperCase();
    } else {
      row.currency = 'VND';
    }

    validRowCount++;
  }

  return {
    valid: errors.length === 0,
    errors,
    validRowCount,
    totalRowCount: rows.length
  };
}

/**
 * Generate a preview of the first N rows for display.
 */
export function generatePreviewRows(
  rows: Record<string, unknown>[],
  limit: number = 10
): Record<string, unknown>[] {
  return rows.slice(0, limit);
}
