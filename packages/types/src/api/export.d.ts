import type { Result } from './base';

/**
 * Export Types
 */
export type ExportFormat = 'xlsx' | 'csv';

export interface ExportResultData {
  buffer: Buffer;
  contentType: string;
  filename: string;
  url?: string;
}

/**
 * Result type for export operations
 */
export type ExportResult = Result<ExportResultData>;
