/**
 * Data/Import-Export Service - Pure Functions
 *
 * Following ElysiaJS functional programming principles:
 * - Pure functions only (no DI, no Elysia context)
 * - Input -> Process -> Output
 * - No side effects in service layer
 * - Database operations passed as parameters
 */

import type { Result } from '@repo/types';
import { BE_ERRORS } from '@repo/errors';

/**
 * Validate export type
 */
export function validateExportType(type: string, allowedTypes: string[]): Result<void> {
  if (!allowedTypes.includes(type)) {
    return {
      code: BE_ERRORS.EXPORT_TYPE_INVALID.code,
      error: `Export type must be one of: ${allowedTypes.join(', ')}`
    };
  }
  return { data: undefined };
}

/**
 * Validate export format
 */
export function validateExportFormat(format: string, allowedFormats: string[]): Result<void> {
  if (!allowedFormats.includes(format)) {
    return {
      code: BE_ERRORS.EXPORT_FORMAT_INVALID.code,
      error: `Export format must be one of: ${allowedFormats.join(', ')}`
    };
  }
  return { data: undefined };
}

/**
 * Validate date range
 */
export function validateDateRange(startDate?: string, endDate?: string): Result<void> {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        code: BE_ERRORS.DATE_FORMAT_INVALID.code,
        error: 'Invalid date format'
      };
    }

    if (start > end) {
      return {
        code: BE_ERRORS.DATE_RANGE_INVALID.code,
        error: 'Start date must be before end date'
      };
    }
  }

  return { data: undefined };
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: Array<Record<string, unknown>>, headers: string[]): string {
  const csvRows: string[] = [];
  
  // Add header row
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      const escaped = ('' + (value ?? '')).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * Format export metadata
 */
export function formatExportMetadata(type: string, format: string, count: number) {
  return {
    type,
    format,
    count,
    exportedAt: new Date()
  };
}

/**
 * Format import result
 */
export function formatImportResult(imported: number, failed: number, errors: string[] = []) {
  return {
    imported,
    failed,
    errors: errors.length > 0 ? errors : undefined
  };
}
